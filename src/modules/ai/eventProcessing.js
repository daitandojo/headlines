// src/modules/ai/eventProcessing.js (version 2.8 - Improved Query Planning)
import client from './client.js';
import { LLM_MODEL_ARTICLES, LLM_MODEL } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { instructionCluster } from '../assessments/instructionCluster.js';
import { instructionSynthesize } from '../assessments/instructionSynthesize.js';
import { safeExecute } from '../../utils/helpers.js';

const ENTITY_MODEL = LLM_MODEL;

// --- NEW: Domain-Constrained Query Planner Prompt ---
const QUERY_PLANNER_PROMPT = `You are a Research Planning Agent for a wealth management firm. Your task is to analyze the provided "Article Text" and determine the most critical entities to look up on Wikipedia for factual verification and enrichment.

**CRITICAL Instructions:**
1.  Your focus is exclusively on **wealth management intelligence**; people and investment entities who have more than $50mm to invest.
2.  You MUST ONLY extract specific, high-value proper nouns relevant to this domain:
    - **Individuals:** Founders, CEOs, UHNW investors, UHNW family members.
    - **Companies & Firms:** Private companies, PE/VC firms, investment vehicles, family offices.
    - **Transactions:** IPOs, M&A deals; events providing liquidity.
3.  You are FORBIDDEN from extracting generic locations (e.g., "Copenhagen", "Denmark") or concepts (e.g., "Pension", "Software").
    The only extraction should be clarification in relation to wealth (entities, named individuals)
4.  Return ONLY the core name of the entity which you would expect a Wikipedia page to exist for (e.g., "FSN Capital", not "FSN Capital (private equity firm)").

Respond ONLY with a valid JSON object:
{
  "reasoning": "A brief explanation of your choice of entities based on wealth management relevance.",
  "entities": ["Precise Search Query 1", "Precise Search Query 2"]
}`;

/**
 * Uses a domain-constrained AI agent to decide which entities to search for on Wikipedia.
 * @param {string} text - The text to analyze.
 * @returns {Promise<string[]>} An array of optimized, relevant search queries (entities).
 */
export async function extractEntities(text) {
    if (!text) return [];
    try {
        const response = await client.chat.completions.create({
            model: ENTITY_MODEL,
            messages: [{ role: 'system', content: QUERY_PLANNER_PROMPT }, { role: 'user', content: `Article Text:\n${text}` }],
            response_format: { type: 'json_object' },
        });
        const { reasoning, entities } = JSON.parse(response.choices[0].message.content);
        logger.info(`[Query Planner Agent] Reasoning: ${reasoning}`);

        if (!entities || !Array.isArray(entities)) return [];

        const sanitizedEntities = entities.map(entity => 
            entity.replace(/\s*\(.*\)\s*/g, '').trim()
        ).filter(Boolean); // Filter out any empty strings
        
        return sanitizedEntities;

    } catch (error) {
        logger.warn({ err: error }, "Wikipedia query planning (entity extraction) failed.");
        return [];
    }
}

// ... (The rest of the file - generateJsonResponse, clusterArticlesIntoEvents, synthesizeEvent, etc. - is unchanged) ...
async function generateJsonResponse(model, instructions, userContent, temperature = 0.1) {
    const messages = [ { role: 'system', content: JSON.stringify(instructions) }, { role: 'user', content: userContent } ];
    const result = await safeExecute(() => client.chat.completions.create({ model, messages, response_format: { type: "json_object" } }));
    if (!result) return { error: 'API call failed' };
    try { return JSON.parse(result.choices[0].message.content); }
    catch (parseError) { logger.error({ err: parseError, content: result.choices[0].message.content }, "JSON Parsing Error"); return { error: "JSON Parsing Error" }; }
}
export async function clusterArticlesIntoEvents(articles) {
    logger.info(`Clustering ${articles.length} articles into unique events...`);
    const articlePayload = articles.map(a => ({ id: a._id.toString(), headline: a.headline, source: a.newspaper, summary: (a.topic || a.assessment_article || '').substring(0, 400) }));
    const userContent = JSON.stringify(articlePayload);
    const response = await generateJsonResponse(LLM_MODEL_ARTICLES, instructionCluster, userContent);
    if (response.error || !response.events) { logger.error('Failed to cluster articles.', { response }); return []; }
    return response.events;
}
export async function synthesizeEvent(articlesInCluster, historicalContext, wikipediaContext) {
    const todayPayload = articlesInCluster.map(a => ({ headline: a.headline, source: a.newspaper, full_text: (a.articleContent?.contents || []).join('\n') }));
    const historyPayload = historicalContext.map(h => ({ headline: h.headline, source: h.newspaper, published: h.createdAt, summary: h.assessment_article || '' }));
    const userContent = JSON.stringify({
        '[ TODAY\'S NEWS ]': todayPayload,
        '[ HISTORICAL CONTEXT (Internal Database) ]': historyPayload,
        '[ PUBLIC WIKIPEDIA CONTEXT ]': wikipediaContext || 'Not available.',
    });
    const response = await generateJsonResponse(LLM_MODEL_ARTICLES, instructionSynthesize, userContent, 0.2);
    if (response.error) { logger.error('Failed to synthesize event.', { response }); return { error: 'Synthesis failed' }; }
    return response;
}
export async function synthesizeFromHeadline(article) {
    logger.warn({ headline: article.headline }, `Salvaging high-signal headline with failed enrichment...`);
    const todayPayload = [{ headline: article.headline, source: article.newspaper, full_text: "NOTE: Full article text could not be retrieved. Synthesize based on the headline's explicit claims and your general knowledge." }];
    const userContent = JSON.stringify({ '[ TODAY\'S NEWS ]': todayPayload, '[ HISTORICAL CONTEXT ]': [], '[ PUBLIC WIKIPEDIA CONTEXT ]': 'Not available.' });
    const response = await generateJsonResponse(LLM_MODEL_ARTICLES, instructionSynthesize, userContent, 0.2);
    if (response.error) { logger.error('Failed to salvage headline.', { response }); return null; }
    return response;
}