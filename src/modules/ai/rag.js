// src/modules/ai/rag.js
import Article from '../../../models/Article.js';
import { logger } from '../../utils/logger.js';
import { generateEmbedding, cosineSimilarity } from '../../utils/vectorUtils.js';

const SIMILARITY_THRESHOLD = 0.65; // Tune this threshold as needed
const MAX_CONTEXT_ARTICLES = 3;

/**
 * Finds historical articles similar to a given set of new articles.
 * @param {Array<Object>} articlesInCluster - The new articles forming an event.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of relevant historical articles.
 */
export async function findSimilarArticles(articlesInCluster) {
    logger.info('RAG: Searching for historical context...');
    if (!articlesInCluster || articlesInCluster.length === 0) return [];

    // 1. Create a query embedding from the new event's content
    const queryText = articlesInCluster.map(a => a.headline).join('\n');
    const queryEmbedding = await generateEmbedding(queryText);

    // 2. Fetch all historical articles with embeddings from the database
    // In a large-scale app, you'd add filters (e.g., date range) here.
    const historicalCandidates = await Article.find({
        embedding: { $exists: true, $ne: null }
    }).lean();

    if (historicalCandidates.length === 0) {
        logger.warn('RAG: No historical articles with embeddings found to search against.');
        return [];
    }

    // 3. Calculate similarity for each candidate
    const scoredArticles = [];
    for (const candidate of historicalCandidates) {
        const similarity = cosineSimilarity(queryEmbedding, candidate.embedding);
        if (similarity >= SIMILARITY_THRESHOLD) {
            scoredArticles.push({ ...candidate, similarity });
        }
    }
    
    // 4. Sort by similarity and return the top N
    scoredArticles.sort((a, b) => b.similarity - a.similarity);
    const topContext = scoredArticles.slice(0, MAX_CONTEXT_ARTICLES);
    
    logger.info(`RAG: Found ${topContext.length} relevant historical articles.`);
    return topContext;
}