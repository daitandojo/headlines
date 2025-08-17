// scripts/chat.js (version 10.2 - Transparent RAG & Corrected Threshold)
import 'dotenv/config';
import readline from 'readline';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { generateEmbedding } from '../src/utils/vectorUtils.js';
import { logger } from '../src/utils/logger.js';
import { PINECONE_API_KEY, PINECONE_INDEX_NAME, GROQ_API_KEY } from '../src/config/index.js';

// --- Configuration & Clients ---
const TOP_K_RESULTS = 5;
const SIMILARITY_THRESHOLD = 0.40; // LOWERED: To be more inclusive of relevant context.
const DUPLICATE_THRESHOLD = 0.95;
const GROQ_MODEL = 'openai/gpt-oss-120b';

if (!PINECONE_API_KEY || !GROQ_API_KEY) throw new Error('API Keys for Pinecone and Groq are required!');

const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const pineconeIndex = pc.index(PINECONE_INDEX_NAME);
const groqClient = new OpenAI({ apiKey: GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });

// --- UI Elements & State ---
const USER_PROMPT = '\nYou > ';
const AI_PROMPT = 'Bot > ';
class ChatState {
    static STATES = { IDLE: 'IDLE', AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION', BUSY: 'BUSY' };
    constructor() { this.currentState = ChatState.STATES.IDLE; this.factToStore = null; }
    set(state, data = null) { this.currentState = state; if (data) this.factToStore = data; }
    is(state) { return this.currentState === state; }
    getFact() { return this.factToStore; }
    reset() { this.currentState = ChatState.STATES.IDLE; this.factToStore = null; }
}

// --- "Fact-Checking First" System Prompts ---
const STREAMING_PROMPT = `You are an elite intelligence analyst and fact-checker for a wealth management firm. Your primary directive is to provide accurate, verified information.

**Strict Response Protocol:**
1.  **Prioritize Database:** If the "Database Context" section contains relevant information, you MUST use it as your primary source. Begin your response with "[DB]:".
2.  **Explain RAG Failure:** If the RAG status is 'LOW_CONFIDENCE', you MUST inform the user. Start with "[DB - Low Confidence]: I found some related information, but it may not be a direct answer. Here's what I found: ...".
3.  **Cautious General Knowledge:** If the RAG status is 'NO_HITS' or the context is irrelevant, you may use your general knowledge. You MUST begin your response with the prefix "[General Knowledge]:".
4.  **Do Not Hallucinate:** If you are not highly confident in an answer from general knowledge, state that you cannot answer reliably.
5.  **Formatting:** Provide a direct, plain-text, natural language response. Do NOT use Markdown.`;

const JSON_ACTION_PROMPT = `You are the logical reasoning part of an AI assistant. Based on the conversation, your task is to determine the correct follow-up action. Your entire response MUST be a single, valid JSON object.

**Your Mandate:**
1.  Analyze the user's latest input.
2.  **CRITICAL:** Only set "action" to "CONFIRM_FACT" if the USER has provided NEW, specific, and storable information that is not already present in the context.
3.  Do NOT ask to confirm facts that you, the assistant, have generated from your own knowledge.

**JSON Output Schema:**
{
  "thought": "Your brief thought process. Example: 'The user asked a question, I answered from the database. No new fact was provided. Action is ANSWER.'",
  "action": "One of: 'ANSWER', 'CONFIRM_FACT', 'CLARIFY'",
  "factToConfirm": null | { "headline": "...", "summary": "...", "key_subject": "..." }
}`;


// --- Core Chat Functions ---

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0.0, normA = 0.0, normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieveContext(queryEmbedding) {
    const queryResponse = await pineconeIndex.query({
        topK: TOP_K_RESULTS,
        vector: queryEmbedding,
        includeMetadata: true,
    });
    
    let ragStatus = 'NO_HITS'; // Default status
    if (queryResponse.matches.length > 0) {
        ragStatus = 'LOW_CONFIDENCE'; // Assume low confidence until a good match is found
    }

    const relevantResults = queryResponse.matches.filter(match => match.score >= SIMILARITY_THRESHOLD);

    if (relevantResults.length === 0) {
        return { context: null, allResults: queryResponse.matches, ragStatus };
    }
    
    ragStatus = 'SUCCESS';
    const context = "### Database Context:\n" + relevantResults
        .map(match => `- ${match.metadata.headline}: ${match.metadata.summary}`)
        .join('\n');
        
    return { context, allResults: queryResponse.matches, ragStatus };
}

async function generateResponseStream(userInput, dbContext, chatHistory, ragStatus) {
    const conversationContext = "### Conversation History:\n" + chatHistory.slice(-8).map(h => `${h.role}: ${h.content}`).join('\n');
    const userPrompt = `RAG Status: ${ragStatus}\n\n${dbContext || 'No relevant database context.'}\n\n${conversationContext}\n\n### User's Latest Input:\n"${userInput}"`;
    const messages = [{ role: 'system', content: STREAMING_PROMPT }, { role: 'user', content: userPrompt }];
    try {
        return await groqClient.chat.completions.create({ model: GROQ_MODEL, messages, stream: true });
    } catch (error) {
        logger.error({ err: error }, "AI stream initiation failed.");
        return null;
    }
}

async function generateActionJson(userInput, dbContext, chatHistory, assistantResponse) {
    const fullContext = `### Database Context:\n${dbContext || 'None'}\n\n### Conversation History:\n${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}`;
    const messages = [{ role: 'system', content: JSON_ACTION_PROMPT }, { role: 'user', content: fullContext }];
    try {
        const response = await groqClient.chat.completions.create({ model: GROQ_MODEL, messages, response_format: { type: 'json_object' } });
        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        logger.error({ err: error }, "AI JSON action generation failed.");
        return { action: 'ANSWER', factToConfirm: null };
    }
}

async function embedAndStoreFact(structuredFact) {
    const newArticle = new Article({
        headline: structuredFact.headline, link: `https://user.facts/fact-entry-${Date.now()}`,
        newspaper: "User-Provided Fact", source: "Conversational Input",
        relevance_headline: 100, assessment_headline: "Fact provided by user.",
        relevance_article: 100, assessment_article: structuredFact.summary,
        key_individuals: structuredFact.key_subject ? [{ name: structuredFact.key_subject, role_in_event: "Subject of Fact" }] : [],
        emailed: true,
    });
    const textToEmbed = `${newArticle.headline}\n${newArticle.assessment_article}`;
    newArticle.embedding = await generateEmbedding(textToEmbed);
    await newArticle.save();
    await pineconeIndex.upsert([{
        id: newArticle._id.toString(), values: newArticle.embedding,
        metadata: { headline: newArticle.headline, summary: newArticle.assessment_article, newspaper: newArticle.newspaper, country: 'N/A' }
    }]);
    logger.info({ id: newArticle._id.toString() }, "Successfully added fact to MongoDB and Pinecone.");
}

async function executePlan(plan, rl, chatState, allRetrievedArticles) {
    if (plan.action === 'CONFIRM_FACT' && plan.factToConfirm) {
        const mostSimilar = allRetrievedArticles.length > 0 ? allRetrievedArticles[0] : null;
        if (mostSimilar && mostSimilar.score > DUPLICATE_THRESHOLD) {
            console.log(`${AI_PROMPT}(I already have similar information: "${mostSimilar.metadata.headline}")`);
        } else {
            chatState.set(ChatState.STATES.AWAITING_CONFIRMATION, plan.factToConfirm);
            rl.question(`\n${AI_PROMPT}Should I remember that? (y/n) > `, (answer) => {
                handleUserInput(answer.trim(), rl, chatState, []);
            });
            return;
        }
    }
    chatState.reset();
    rl.setPrompt(USER_PROMPT);
    rl.prompt();
}

async function handleUserInput(userInput, rl, chatState, chatHistory) {
    if (chatState.is(ChatState.STATES.BUSY)) return;
    chatState.set(ChatState.STATES.BUSY);
    try {
        if (chatState.is(ChatState.STATES.AWAITING_CONFIRMATION)) {
            const affirmative = /^(y|yes|yeah|yep|ok|sure|correct)/i.test(userInput);
            if (affirmative) {
                await embedAndStoreFact(chatState.getFact());
                console.log(`${AI_PROMPT}Got it. I'll remember that.`);
            } else {
                console.log(`${AI_PROMPT}Okay, I won't store that.`);
            }
            chatState.reset();
            rl.setPrompt(USER_PROMPT);
            rl.prompt();
            return;
        }

        const queryEmbedding = await generateEmbedding(userInput);
        const { context, allResults, ragStatus } = await retrieveContext(queryEmbedding);
        const stream = await generateResponseStream(userInput, context, chatHistory, ragStatus);

        if (!stream) {
            console.log(`${AI_PROMPT}I'm having trouble connecting to my knowledge base. Please try again.`);
            chatState.reset(); rl.prompt(); return;
        }

        process.stdout.write(AI_PROMPT);
        let fullResponseText = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            process.stdout.write(content);
            fullResponseText += content;
        }
        process.stdout.write('\n');

        chatHistory.push({ role: 'user', content: userInput });
        chatHistory.push({ role: 'assistant', content: fullResponseText });

        const plan = await generateActionJson(userInput, context, chatHistory, fullResponseText);
        await executePlan(plan, rl, chatState, allResults);

    } catch (error) {
        logger.error({ err: error }, 'An error occurred while handling user input.');
        console.log(`${AI_PROMPT}I encountered an unexpected issue. Please try again.`);
        chatState.reset(); rl.prompt();
    }
}

async function main() {
    console.log("Connecting to databases...");
    await connectDatabase();
    const indexStats = await pineconeIndex.describeIndexStats();
    const vectorCount = indexStats.totalRecordCount || 0;
    console.log(`Connected to Pinecone. Index '${PINECONE_INDEX_NAME}' contains ${vectorCount} articles.`);
    if (vectorCount === 0) {
        logger.warn("Your Pinecone index is empty. Please run the migration script.");
    }
    
    console.log("Wealth Analyst Assistant is ready.");
    console.log(`Using AI Engine: GROQ (Model: ${GROQ_MODEL})\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const chatState = new ChatState();
    const chatHistory = [];
    rl.setPrompt(USER_PROMPT);
    rl.prompt();

    rl.on('line', (line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase() === 'exit' || trimmedLine.toLowerCase() === 'quit') rl.close();
        else if (trimmedLine) handleUserInput(trimmedLine, rl, chatState, chatHistory);
        else rl.prompt();
    });

    rl.on('close', async () => {
        console.log(`\nGoodbye!`);
        await disconnectDatabase();
        process.exit(0);
    });
}

main().catch(err => {
    logger.fatal({ err }, 'Chatbot encountered a fatal error.');
    process.exit(1);
});