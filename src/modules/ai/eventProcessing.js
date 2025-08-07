// src/modules/ai/eventProcessing.js (version 2.1)
import client from './client.js'; // Use the new centralized client
import { LLM_MODEL_ARTICLES, CONCURRENCY_LIMIT } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { instructionCluster } from '../assessments/instructionCluster.js';
import { instructionSynthesize } from '../assessments/instructionSynthesize.js';
import { safeExecute } from '../../utils/helpers.js';

async function generateJsonResponse(model, instructions, userContent, temperature = 0.1) {
    const messages = [
        { role: 'system', content: JSON.stringify(instructions) },
        { role: 'user', content: userContent },
    ];

    const result = await safeExecute(() => client.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature,
        // This prevents the API from truncating the JSON response when clustering many articles.
        max_tokens: 8192, 
    }));

    if (!result) return { error: 'API call failed' };

    try {
        return JSON.parse(result.choices[0].message.content);
    } catch (parseError) {
        logger.error({ err: parseError, content: result.choices[0].message.content }, "JSON Parsing Error in AI response");
        return { error: "JSON Parsing Error" };
    }
}

export async function clusterArticlesIntoEvents(articles) {
    logger.info(`Clustering ${articles.length} articles into unique events...`);
    const articlePayload = articles.map(a => ({
        id: a._id.toString(),
        headline: a.headline,
        source: a.newspaper,
        summary: (a.articleContent?.contents || []).join(' ').substring(0, 400),
    }));

    const userContent = JSON.stringify(articlePayload);
    const response = await generateJsonResponse(LLM_MODEL_ARTICLES, instructionCluster, userContent);

    if (response.error || !response.events) {
        logger.error('Failed to cluster articles.', { response });
        return [];
    }

    return response.events; // Expected format: [{ event_key: "...", article_ids: ["...", "..."] }]
}


export async function synthesizeEvent(articlesInCluster, historicalContext) {
    logger.info(`Synthesizing event for cluster with ${articlesInCluster.length} articles.`);

    const todayPayload = articlesInCluster.map(a => ({
        headline: a.headline,
        source: a.newspaper,
        full_text: (a.articleContent?.contents || []).join('\n'),
    }));

    const historyPayload = historicalContext.map(h => ({
        headline: h.headline,
        source: h.newspaper,
        published: h.createdAt,
        summary: (h.articleContent?.contents || []).join(' ').substring(0, 500),
    }));

    const userContent = JSON.stringify({
        todays_articles: todayPayload,
        historical_articles: historyPayload,
    });

    const response = await generateJsonResponse(LLM_MODEL_ARTICLES, instructionSynthesize, userContent, 0.2);

    if (response.error) {
        logger.error('Failed to synthesize event.', { response });
        return { error: 'Synthesis failed' };
    }
    
    // Expected format: { headline: "...", summary: "...", key_individuals: [...] }
    return response;
}