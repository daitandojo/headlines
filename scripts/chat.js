// scripts/chat.js (version 2.0)
import 'dotenv/config';
import readline from 'readline';
import groq from '../modules/ai/client.js'; // Use the new centralized client
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { generateEmbedding, cosineSimilarity } from '../src/utils/vectorUtils.js';
import { logger } from '../src/utils/logger.js';
import { LLM_MODEL_HEADLINES } from '../src/config/index.js';

// --- Configuration ---
const TOP_K_RESULTS = 7;
const CANDIDATE_POOL_SIZE = 250;
const DUPLICATE_THRESHOLD = 0.95;

// --- UI Colors ---
const colors = { reset: "\x1b[0m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m" };
const USER_PROMPT = `${colors.cyan}You > ${colors.reset}`;
const AI_PROMPT = `${colors.green}Bot >${colors.reset} `;

/** Embeds and stores a structured fact. */
async function embedAndStoreFact(structuredFact) {
    const newArticle = new Article({
        headline: structuredFact.headline,
        link: `https://user.facts/fact-entry-${Date.now()}`,
        newspaper: "User-Provided Fact", source: "Conversational Input",
        relevance_headline: 100, assessment_headline: "Fact provided by user.",
        relevance_article: 100, assessment_article: "Fact provided by user.",
        articleContent: { contents: [structuredFact.summary] },
        key_individuals: [{ name: structuredFact.key_subject, role_in_event: "Subject of Fact" }],
        emailed: true,
    });
    const textToEmbed = `${newArticle.headline}\n${newArticle.articleContent.contents.join(' ')}`;
    newArticle.embedding = await generateEmbedding(textToEmbed);
    await newArticle.save();
}

/** Main function to run the interactive chat loop. */
async function main() {
    console.log('Connecting to database...');
    await connectDatabase();
    console.log('Database connected. Wealth Analyst Assistant is ready.\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const chatHistory = [];
    let state = { type: 'idle' };

    async function handleUserInput(userInput) {
        if (state.type === 'waiting_for_confirmation') {
            const affirmativeRegex = /^(y|yes|yeah|yep|ok|sure|correct)/i;
            if (affirmativeRegex.test(userInput)) {
                await embedAndStoreFact(state.factToStore);
                console.log(`${AI_PROMPT}Got it. I'll remember that.`);
                chatHistory.push({ role: 'user', content: userInput });
                chatHistory.push({ role: 'assistant', content: `Acknowledged. Stored fact: ${state.factToStore.summary}` });
            } else {
                console.log(`${AI_PROMPT}${colors.yellow}Okay, I won't store that.${colors.reset}`);
            }
            state = { type: 'idle' };
            rl.setPrompt(USER_PROMPT);
            rl.prompt();
            return;
        }

        // --- 1. CONTEXT GATHERING ---
        const queryEmbedding = await generateEmbedding(userInput);
        const candidateArticles = await Article.find({ embedding: { $exists: true, $ne: null } }).sort({ createdAt: -1 }).limit(CANDIDATE_POOL_SIZE).lean();
        let dbContext = "The database contains no relevant information on this topic.";
        if (candidateArticles.length > 0) {
            const scoredArticles = candidateArticles.map(article => ({ ...article, score: cosineSimilarity(queryEmbedding, article.embedding) }));
            scoredArticles.sort((a, b) => b.score - a.score);
            const retrievedArticles = scoredArticles.slice(0, TOP_K_RESULTS);
            if (retrievedArticles.length > 0 && retrievedArticles[0].score > 0.4) {
                dbContext = "### Database Context:\n" + retrievedArticles.map(article => `- ${article.headline}: ${article.articleContent.contents.join(' ')}`).join('\n');
            }
        }
        const conversationContext = "### Conversation History:\n" + chatHistory.slice(-8).map(h => `${h.role}: ${h.content}`).join('\n');

        // --- 2. THE UNIFIED "THINKING" PROMPT ---
        const systemPrompt = `You are an elite intelligence analyst for a wealth management firm. Your goal is to be a concise, intelligent conversational partner. Analyze the user's LATEST input in the context of the full conversation and database.

        **Your Mandate & Hierarchy of Truth:**
        1.  **Synthesize All Known Information:** Formulate a concise, direct answer by synthesizing facts from BOTH the "Database Context" AND the "Conversation History". Treat the conversation history as a primary source of truth to avoid amnesia.
        2.  **Deduce and Infer:** Act like an analyst. Make logical deductions. If someone founded a major company, you can deduce they are wealthy. If you know X advises Y, you can answer questions about Y's advisor.
        3.  **Use General Knowledge Fluidly:** If the answer is not in your known information, state this clearly and then seamlessly provide the answer from your general knowledge (e.g., "The database doesn't have details on his company, but from my general knowledge, Stig Holledig is the founder of Holledig Capital..."). Do NOT ask for permission.
        4.  **Handle Corrections Gracefully:** If the user corrects you ("No, that's wrong..."), accept the correction immediately and prioritize their new information as the truth.
        5.  **Identify New, Valuable Facts:** If the user provides a genuinely new, valuable, non-contradictory fact, identify it for storage. Check if it's a duplicate of existing knowledge first.

        **Your JSON Output:**
        Respond ONLY with a valid JSON object:
        {
          "thought": "Your brief, one-sentence thought process. Example: 'The user is correcting me about John Blem. I will acknowledge the correction and propose storing the new fact.'",
          "responseText": "The natural, conversational text to display to the user. This is your primary output. Keep it concise.",
          "action": "One of: 'answer', 'confirm_fact', 'clarify'",
          "factToConfirm": {
            "headline": "Structured headline for the new fact",
            "summary": "Structured summary for the new fact",
            "key_subject": "Primary person/company"
          } OR null
        }`;

        const userPrompt = `${dbContext}\n\n${conversationContext}\n\n### User's Latest Input:\n"${userInput}"`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];

        // --- 3. EXECUTE AND ACT ---
        let plan;
        try {
            const response = await groq.chat.completions.create({ model: LLM_MODEL_HEADLINES, messages, response_format: { type: 'json_object' } });
            plan = JSON.parse(response.choices[0].message.content);
        } catch (e) {
            console.log(`${AI_PROMPT}${colors.yellow}I'm having a little trouble processing that. Could you please rephrase?${colors.reset}`);
            rl.prompt(); return;
        }

        chatHistory.push({ role: 'user', content: userInput });
        if (plan.responseText) {
            console.log(`${AI_PROMPT}${plan.responseText}`);
            chatHistory.push({ role: 'assistant', content: plan.responseText });
        }

        if (plan.action === 'confirm_fact' && plan.factToConfirm) {
            const factSummary = plan.factToConfirm.summary;
            const factEmbedding = await generateEmbedding(factSummary);
            const similarities = candidateArticles.map(art => cosineSimilarity(factEmbedding, art.embedding || []));
            if (similarities.length > 0 && Math.max(...similarities) > DUPLICATE_THRESHOLD) {
                // It's a duplicate, do nothing further.
            } else {
                state = { type: 'waiting_for_confirmation', factToStore: plan.factToConfirm };
                rl.setPrompt('');
                rl.question(`${AI_PROMPT}${colors.yellow}Should I remember that? (y/n) > ${colors.reset}`, (answer) => {
                    handleUserInput(answer);
                });
                return;
            }
        }
        rl.prompt();
    }

    rl.setPrompt(USER_PROMPT);
    rl.prompt();
    rl.on('line', (line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase() === 'exit' || trimmedLine.toLowerCase() === 'quit') rl.close();
        else if (trimmedLine) handleUserInput(trimmedLine);
        else rl.prompt();
    });

    rl.on('close', async () => {
        console.log('\nExiting. Goodbye!');
        await disconnectDatabase();
        process.exit(0);
    });
}

main().catch(err => {
    logger.fatal({ err }, 'Chatbot encountered a fatal error.');
    process.exit(1);
});