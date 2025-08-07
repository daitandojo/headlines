// src/modules/ai/index.js (version 2.0)
import pLimit from 'p-limit';
import groq from './client.js'; // Use the new centralized client
import { LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES, AI_BATCH_SIZE, CONCURRENCY_LIMIT, HEADLINES_RELEVANCE_THRESHOLD } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { instructionHeadlines } from '../assessments/instructionHeadlines.js';
import { shotsInput as shotsInputHeadlines, shotsOutput as shotsOutputHeadlines } from '../assessments/shotsHeadlines.js';
import { instructionArticle } from '../assessments/instructionArticle.js';
import { shotsInput as shotsInputArticle, shotsOutput as shotsOutputArticle } from '../assessments/shotsArticle.js';
import { safeExecute, truncateString } from '../../utils/helpers.js';

const limit = pLimit(CONCURRENCY_LIMIT);
let isApiKeyInvalid = false;

/**
 * Performs a sanity check against the configured AI service (Groq).
 * @returns {Promise<boolean>}
 */
export async function performAiSanityCheck() {
    try {
        logger.info('🔬 Performing AI service sanity check (Groq)...');
        const response = await groq.chat.completions.create({
            model: "llama3-8b-8192", // Use a small, fast model for the check
            messages: [{ role: 'user', content: 'What is in one word the name of the capital of France' }],
            temperature: 0,
        }, { timeout: 20 * 1000 });
        const answer = response.choices[0].message.content.trim().toLowerCase();
        if (answer.includes('paris')) {
            logger.info('✅ AI service sanity check passed.');
            return true;
        } else {
            logger.fatal(`Groq sanity check failed. Expected a response containing "Paris", but got: "${answer}".`);
            return false;
        }
    } catch (error) {
        if (error.status === 401) {
            logger.fatal(`Groq sanity check failed due to INVALID API KEY (401). Please verify your GROQ_API_KEY in the .env file.`);
        } else {
            logger.fatal({ err: error }, 'Groq sanity check failed with an unexpected API error.');
        }
        isApiKeyInvalid = true;
        return false;
    }
}

/**
 * Verifies that the configured LLM models are available via the AI provider.
 * @param {string[]} requiredModels - An array of model ID strings to check.
 * @returns {Promise<boolean>}
 */
export async function checkModelPermissions(requiredModels) {
    logger.info('🔬 Verifying permissions for configured Groq models...');
    try {
        const response = await groq.models.list();
        const availableModels = new Set(response.data.map(model => model.id));
        for (const model of requiredModels) {
            if (!availableModels.has(model)) {
                logger.fatal(`Model validation failed. The configured model "${model}" is not available on Groq or you don't have permission. Please check your .env file.`);
                logger.info({ availableModels: [...availableModels] }, 'Available models for your API key:');
                return false;
            }
        }
        logger.info('✅ All configured models are available.');
        return true;
    } catch (error) {
        logger.fatal({ err: error }, 'Failed to retrieve model list from Groq API.');
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
    const apiCallPromise = safeExecute(() => groq.chat.completions.create({
        model, messages, response_format: { type: "json_object" }, temperature: 0.1,
    }), {
        errorHandler: (err) => {
            if (err.status === 401) {
                isApiKeyInvalid = true;
                logger.fatal('GROQ API KEY IS INVALID. Halting all AI requests.');
                return { error: 'Invalid Groq API Key' };
            }
            logger.error(`Groq API Error: ${err.name} - ${err.message}`);
            return { error: `Groq API Error: ${err.message}` };
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


export async function assessHeadlinesInBatches(articles) {
    const batches = [];
    for (let i = 0; i < articles.length; i += AI_BATCH_SIZE) {
        batches.push(articles.slice(i, i + AI_BATCH_SIZE));
    }
    logger.info(`Assessing ${articles.length} headlines in ${batches.length} batches...`);
    const allAssessedPromises = [];
    let completedBatches = 0;

    for (const batch of batches) {
        allAssessedPromises.push(
            limit(async () => {
                const headlinesText = batch.map(a => a.headline).join('\n- ');
                const response = await generateAssessment(LLM_MODEL_TRIAGE, instructionHeadlines, headlinesText, shotsInputHeadlines, shotsOutputHeadlines);
                
                completedBatches++;
                
                // --- FIX: Restore detailed per-headline logging for debugging ---
                if (response && response.assessment && Array.isArray(response.assessment)) {
                    logger.info(`--- Batch ${completedBatches}/${batches.length} Results ---`);
                    batch.forEach((article, i) => {
                        const assessment = response.assessment[i];
                        if (assessment && typeof assessment.relevance_headline === 'number') {
                            const score = assessment.relevance_headline;
                            const comment = assessment.assessment_headline || 'No comment.';
                            const emoji = score >= HEADLINES_RELEVANCE_THRESHOLD ? '✅' : '❌';
                            const source = article.source || 'Unknown';
                            logger.info(`${emoji} [${String(score).padStart(3)}] "${truncateString(article.headline, 60)}" (${source}) | ${truncateString(comment, 45)}`);
                        } else {
                            const source = article.source || 'Unknown';
                            logger.warn(`- Malformed assessment for: "${truncateString(article.headline, 70)}" (${source})`);
                        }
                    });
                } else {
                    logger.error(`❌ Headline assessment failed for batch ${completedBatches}/${batches.length}. Reason: ${response.error || 'Malformed response'}`);
                }
                // --- END FIX ---

                if (response.error || !response.assessment || !Array.isArray(response.assessment) || response.assessment.length !== batch.length) {
                    return batch.map(article => ({ ...article, relevance_headline: 0, assessment_headline: response.error || 'AI assessment failed.' }));
                }

                return batch.map((article, i) => ({ ...article, ...response.assessment[i] }));
            })
        );
    }
    
    const assessedBatches = await Promise.all(allAssessedPromises);
    logger.info('Finished assessing all headline batches.');
    return assessedBatches.flat();
}

export async function assessArticleContent(article) {
    logger.info(`Assessing content for: "${truncateString(article.headline, 60)}"`);
    
    // --- FIX: Combine headline and body to give the AI full context ---
    const articleText = `HEADLINE: ${article.headline}\n\nBODY:\n${article.articleContent.contents.join('\n')}`;
    
    const response = await generateAssessment(LLM_MODEL_ARTICLES, instructionArticle, articleText, shotsInputArticle, shotsOutputArticle);
    
    if (response.error) {
        logger.error(`Article assessment failed for ${article.link}.`);
        return { ...article, error: `AI Error: ${response.error}` };
    }
    return { ...article, ...response, error: null };
}