// src/modules/ai/index.js (version 2.3)
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { KIMI_API_KEY, LLM_MODEL_HEADLINES, LLM_MODEL_ARTICLES, AI_BATCH_SIZE, CONCURRENCY_LIMIT, HEADLINES_RELEVANCE_THRESHOLD } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { instructionHeadlines } from '../assessments/instructionHeadlines.js';
import { shotsInput as shotsInputHeadlines, shotsOutput as shotsOutputHeadlines } from '../assessments/shotsHeadlines.js';
import { instructionArticle } from '../assessments/instructionArticle.js';
import { shotsInput as shotsInputArticle, shotsOutput as shotsOutputArticle } from '../assessments/shotsArticle.js';
import { safeExecute, truncateString } from '../../utils/helpers.js';

if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY is not defined in the environment variables.');
}

const kimi = new OpenAI({
    apiKey: 'dummy-key',
    baseURL: 'https://api.moonshot.ai/v1',
    defaultHeaders: { 'Authorization': `Bearer ${KIMI_API_KEY}` },
    timeout: 90 * 1000,
    maxRetries: 1,
});

const limit = pLimit(CONCURRENCY_LIMIT);
let isApiKeyInvalid = false;

// --- UNCHANGED FUNCTIONS ---
export async function performKimiSanityCheck() {
    try {
        logger.info('🔬 Performing Kimi AI service sanity check...');
        const response = await kimi.chat.completions.create({
            model: "moonshot-v1-8k", messages: [{ role: 'user', content: 'What is in one word the name of the capital of France' }], temperature: 0,
        }, { timeout: 20 * 1000 });
        const answer = response.choices[0].message.content.trim().toLowerCase();
        if (answer.includes('paris')) { return true; }
        else {
            logger.fatal(`Kimi sanity check failed. Expected a response containing "Paris", but got: "${answer}".`);
            return false;
        }
    } catch (error) {
        if (error.status === 401) {
            let keyHint = 'The key is either missing, empty, or too short to be valid.';
            if (KIMI_API_KEY && KIMI_API_KEY.length > 8) {
                const maskedKey = `${KIMI_API_KEY.substring(0, 5)}...${KIMI_API_KEY.slice(-4)}`;
                keyHint = `Key being used: ${maskedKey}`;
            }
            logger.fatal(`Kimi sanity check failed due to INVALID API KEY (401). ${keyHint}. Please verify your .env file and the baseURL.`);
        } else {
            logger.fatal({ err: error }, 'Kimi sanity check failed with an unexpected API error.');
        }
        isApiKeyInvalid = true;
        return false;
    }
}

export async function checkModelPermissions(requiredModels) {
    logger.info('🔬 Verifying permissions for configured Kimi models...');
    try {
        const response = await kimi.models.list();
        const availableModels = new Set(response.data.map(model => model.id));
        for (const model of requiredModels) {
            if (!availableModels.has(model)) {
                logger.fatal(`Model validation failed. The configured model "${model}" is not available or you don't have permission. Please check your .env file.`);
                logger.info({ availableModels: [...availableModels] }, 'Available models for your API key:');
                return false;
            }
        }
        return true;
    } catch (error) {
        logger.fatal({ err: error }, 'Failed to retrieve model list from Kimi API.');
        isApiKeyInvalid = true;
        return false;
    }
}

async function generateAssessment(model, instructions, userContent, fewShotInputs = [], fewShotOutputs = []) {
    if (isApiKeyInvalid) { return { error: 'API Key is invalid. Halting further AI assessments.' }; }
    const messages = [ { role: 'system', content: JSON.stringify(instructions) } ];
    fewShotInputs.forEach((input, i) => {
        let shotContent = (typeof input === 'string') ? input : (input && input.articleText);
        if (shotContent && typeof shotContent === 'string') {
            messages.push({ role: 'user', content: shotContent });
            messages.push({ role: 'assistant', content: fewShotOutputs[i] });
        }
    });
    messages.push({ role: 'user', content: userContent });
    const apiCallPromise = safeExecute(() => kimi.chat.completions.create({
        model, messages, response_format: { type: "json_object" }, temperature: 0.1,
    }), {
        errorHandler: (err) => {
            if (err.status === 401) {
                isApiKeyInvalid = true;
                logger.fatal('KIMI API KEY IS INVALID. Halting all AI requests.');
                return { error: 'Invalid Kimi API Key' };
            }
            logger.error(`Kimi API Error: ${err.name} - ${err.message}`);
            return { error: `Kimi API Error: ${err.message}` };
        }
    });
    let timeoutHandle;
    const timeoutPromise = new Promise((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ error: 'External watchdog timed out after 100s' }), 100 * 1000);
    });
    const result = await Promise.race([apiCallPromise, timeoutPromise]);
    clearTimeout(timeoutHandle);
    if (result.error) return result;
    try {
        return JSON.parse(result.choices[0].message.content);
    } catch (parseError) {
        logger.error(`JSON Parse Error: ${parseError.message}`);
        return { error: "JSON Parsing Error" };
    }
}

// --- REFACTORED BATCH ASSESSMENT LOGGING ---
export async function assessHeadlinesInBatches(articles) {
    const batches = [];
    for (let i = 0; i < articles.length; i += AI_BATCH_SIZE) {
        batches.push(articles.slice(i, i + AI_BATCH_SIZE));
    }
    logger.info(`Assessing ${articles.length} headlines in ${batches.length} batches.`);
    const allAssessedPromises = [];
    let completedBatches = 0;

    for (const batch of batches) {
        allAssessedPromises.push(
            limit(async () => {
                const headlinesText = batch.map(a => a.headline).join('\n- ');
                const response = await generateAssessment(LLM_MODEL_HEADLINES, instructionHeadlines, headlinesText, shotsInputHeadlines, shotsOutputHeadlines);
                
                completedBatches++;
                
                // --- NEW CONCISE LOGGING ---
                if (response && response.assessment && Array.isArray(response.assessment)) {
                    logger.info(`--- Batch ${completedBatches}/${batches.length} Results ---`);
                    batch.forEach((article, i) => {
                        const assessment = response.assessment[i];
                        if (assessment && typeof assessment.relevance_headline === 'number') {
                            const score = assessment.relevance_headline;
                            const comment = assessment.assessment_headline || 'No comment.';
                            const emoji = score >= HEADLINES_RELEVANCE_THRESHOLD ? '✅' : '❌';
                            logger.info(`${emoji} [${score}] ${truncateString(article.headline, 70)} | ${truncateString(comment, 60)}`);
                        } else {
                            logger.warn(`- Malformed assessment for: ${truncateString(article.headline, 70)}`);
                        }
                    });
                } else {
                    logger.error(`❌ Headline assessment failed for batch ${completedBatches}/${batches.length}. Reason: ${response.error || 'Malformed response'}`);
                }
                // --- END NEW LOGGING ---

                if (response.error || !response.assessment || !Array.isArray(response.assessment) || response.assessment.length !== batch.length) {
                    return batch.map(article => ({ ...article, relevance_headline: 0, assessment_headline: response.error || 'AI assessment failed.' }));
                }

                return batch.map((article, i) => ({ ...article, ...response.assessment[i] }));
            })
        );
    }
    
    const assessedBatches = await Promise.all(allAssessedPromises);
    logger.info(`Finished assessing all ${batches.length} batches.`);
    return assessedBatches.flat();
}

export async function assessArticleContent(article) {
    logger.info(`Assessing content for: "${truncateString(article.headline, 60)}"`);
    const articleText = article.articleContent.contents.join('\n');
    const response = await generateAssessment(LLM_MODEL_ARTICLES, instructionArticle, articleText, shotsInputArticle, shotsOutputArticle);
    if (response.error) {
        logger.error(`Article assessment failed for ${article.link}.`);
        return { ...article, error: `AI Error: ${response.error}` };
    }
    return { ...article, ...response, error: null };
}