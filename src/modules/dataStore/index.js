// src/modules/dataStore/index.js (version 3.6 - Conditional Content Saving)
import { Pinecone } from '@pinecone-database/pinecone';
import Article from '../../../models/Article.js';
import SynthesizedEvent from '../../../models/SynthesizedEvent.js';
import { logger } from '../../utils/logger.js';
import { generateEmbedding } from '../../utils/vectorUtils.js';
import { PINECONE_API_KEY, PINECONE_INDEX_NAME } from '../../config/index.js';

if (!PINECONE_API_KEY) throw new Error('Pinecone API Key is missing!');
const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const pineconeIndex = pc.index(PINECONE_INDEX_NAME);

/**
 * Saves pipeline results to MongoDB and Pinecone.
 * @param {Array} articlesToSave - The array of all articles processed in the run.
 * @param {Array} eventsToSave - The array of synthesized events.
 * @returns {Promise<{success: boolean, savedEvents: Array<Object>}>} A promise that resolves with the success status and an array of the saved event plain objects.
 */
export async function savePipelineResults(articlesToSave, eventsToSave) {
    logger.info(`Committing pipeline results to databases (MongoDB & Pinecone)...`);
    
    let savedEvents = [];

    try {
        const articleOps = [];
        const pineconeVectors = [];

        if (articlesToSave && articlesToSave.length > 0) {
            for (const article of articlesToSave) {
                if (article.relevance_article && article.articleContent) {
                    const textToEmbed = `${article.headline}\n${article.assessment_article || ''}`;
                    article.embedding = await generateEmbedding(textToEmbed);
                }
                const articleId = article._id.toString(); 
                if (article.embedding) {
                    pineconeVectors.push({
                        id: articleId,
                        values: article.embedding,
                        metadata: {
                            headline: article.headline,
                            summary: article.assessment_article || 'No summary.',
                            newspaper: article.newspaper,
                            country: article.country
                        }
                    });
                }
                const { _id, ...dataToSet } = article;
                Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);
                
                // --- DEFINITIVE FIX: CONDITIONAL CONTENT DELETION ---
                // To save database space, we only store the full article content if the article is
                // considered "relevant" enough to be displayed in the frontend UI. The frontend
                // filter is set to show articles where either score is greater than 25.
                // If an article does not meet this condition, we can safely discard its large content payload.
                const isRelevantForUI = (dataToSet.relevance_headline > 25) || (dataToSet.relevance_article > 25);
                if (!isRelevantForUI) {
                    delete dataToSet.articleContent;
                }
                // --- END DEFINITIVE FIX ---
                
                delete dataToSet.embedding; 
                articleOps.push({
                    updateOne: { filter: { link: article.link }, update: { $set: dataToSet }, upsert: true }
                });
            }
            await Article.bulkWrite(articleOps, { ordered: false });
            logger.info(`MongoDB Article commit complete. Upserted/Modified: ${articleOps.length}.`);
            if (pineconeVectors.length > 0) {
                await pineconeIndex.upsert(pineconeVectors);
                logger.info(`Pinecone commit complete. Upserted ${pineconeVectors.length} vectors.`);
            }
        }

        if (eventsToSave && eventsToSave.length > 0) {
            const eventOps = [];
            for (const event of eventsToSave) {
                const eventPayload = event.toObject ? event.toObject() : event;
                delete eventPayload._id;
                eventOps.push({
                    updateOne: { filter: { event_key: event.event_key }, update: { $set: { ...eventPayload, emailed: false } }, upsert: true }
                });
            }
            const eventResult = await SynthesizedEvent.bulkWrite(eventOps, { ordered: false });
            logger.info(`MongoDB Event commit complete. Upserted: ${eventResult.upsertedCount}, Modified: ${eventResult.modifiedCount}.`);
            
            const eventKeys = eventsToSave.map(e => e.event_key);
            savedEvents = await SynthesizedEvent.find({ event_key: { $in: eventKeys } }).lean();
        } else {
            logger.info('No new articles or events to commit.');
        }
        
        return { success: true, savedEvents };

    } catch (error) {
        logger.fatal({ err: error }, 'CRITICAL: Failed to commit pipeline results to the databases.');
        return { success: false, savedEvents: [] };
    }
}

export async function filterFreshArticles(articles, isRefreshMode = false) {
    if (!articles || articles.length === 0) return [];
    const scrapedLinks = articles.map(a => a.link);
    if (isRefreshMode) {
        logger.warn('REFRESH MODE: All scraped articles will be processed, pulling existing data from DB where available.');
        const existingDbArticles = await Article.find({ link: { $in: scrapedLinks } }).lean();
        const existingArticlesMap = new Map(existingDbArticles.map(a => [a.link, a._id]));
        const articlesForReprocessing = articles.map(scrapedArticle => existingArticlesMap.get(scrapedArticle.link) ? { ...scrapedArticle, _id: existingArticlesMap.get(scrapedArticle.link) } : scrapedArticle);
        logger.info(`REFRESH MODE: Prepared ${articlesForReprocessing.length} articles for full re-processing.`);
        return articlesForReprocessing;
    }
    const existingArticles = await Article.find({ link: { $in: scrapedLinks } }).select('link').lean();
    const existingLinks = new Set(existingArticles.map(a => a.link));
    const freshArticles = articles.filter(a => !existingLinks.has(a.link));
    logger.info(`Filtering complete. Found ${existingLinks.size} existing articles from previous runs, ${freshArticles.length} are fresh.`);
    return freshArticles;
}