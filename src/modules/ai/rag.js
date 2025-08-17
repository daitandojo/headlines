// src/modules/ai/rag.js (version 2.1 - Add RAG Result Logging)
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../../utils/logger.js';
import { generateEmbedding } from '../../utils/vectorUtils.js';
import { PINECONE_API_KEY, PINECONE_INDEX_NAME } from '../../config/index.js';

const SIMILARITY_THRESHOLD = 0.65;
const MAX_CONTEXT_ARTICLES = 3;

if (!PINECONE_API_KEY) {
    throw new Error('Pinecone API Key must be defined in .env file for RAG module.');
}
const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const pineconeIndex = pc.index(PINECONE_INDEX_NAME);

/**
 * Finds historical articles similar to a given set of new articles by querying Pinecone.
 * @param {Array<Object>} articlesInCluster - The new articles forming an event.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of relevant historical articles.
 */
export async function findSimilarArticles(articlesInCluster) {
    logger.info('RAG: Searching for historical context in Pinecone...');
    if (!articlesInCluster || articlesInCluster.length === 0) return [];

    const queryText = articlesInCluster.map(a => a.headline).join('\n');
    const queryEmbedding = await generateEmbedding(queryText);

    try {
        const queryResponse = await pineconeIndex.query({
            topK: MAX_CONTEXT_ARTICLES,
            vector: queryEmbedding,
            includeMetadata: true,
        });

        const relevantMatches = queryResponse.matches.filter(match => match.score >= SIMILARITY_THRESHOLD);

        if (relevantMatches.length > 0) {
            // --- NEW: Log the headlines and scores of retrieved articles ---
            const retrievedArticlesForLogging = relevantMatches.map(match => 
                `  - [Score: ${match.score.toFixed(3)}] "${match.metadata.headline}"`
            ).join('\n');
            logger.info(`RAG: Found ${relevantMatches.length} relevant historical articles:\n${retrievedArticlesForLogging}`);
            // --- END NEW LOGGING ---
            
            return relevantMatches.map(match => ({
                headline: match.metadata.headline,
                newspaper: match.metadata.newspaper,
                assessment_article: match.metadata.summary
            }));
        } else {
            logger.info('RAG: Found no relevant historical articles in Pinecone.');
            return [];
        }
    } catch (error) {
        logger.error({ err: error }, "RAG: Pinecone query failed.");
        return [];
    }
}