// src/modules/mongoStore/index.js (version 2.1)
import Article from '../../../models/Article.js';
import SynthesizedEvent from '../../../models/SynthesizedEvent.js';
import { logger } from '../../utils/logger.js';
import { generateEmbedding } from '../../utils/vectorUtils.js';

/**
 * Filters a list of scraped articles against the database to find which ones are new.
 * This is the only database read operation at the start of the pipeline.
 * In refresh mode, it pulls existing articles from the DB to be re-processed.
 * @param {Array} articles - The array of freshly scraped articles.
 * @param {boolean} isRefreshMode - Flag for re-processing.
 * @returns {Promise<Array>} An array of articles to be processed in the pipeline.
 */
export async function filterFreshArticles(articles, isRefreshMode = false) {
    if (!articles || articles.length === 0) return [];

    const scrapedLinks = articles.map(a => a.link);

    if (isRefreshMode) {
        logger.warn('REFRESH MODE: All scraped articles will be processed, pulling existing data from DB where available.');
        const existingDbArticles = await Article.find({ link: { $in: scrapedLinks } }).lean();
        const existingArticlesMap = new Map(existingDbArticles.map(a => [a.link, a]));
        
        const articlesForReprocessing = articles.map(scrapedArticle => {
            return existingArticlesMap.get(scrapedArticle.link) || scrapedArticle;
        });

        logger.info(`REFRESH MODE: Prepared ${articlesForReprocessing.length} articles for full re-processing.`);
        return articlesForReprocessing;
    }
    
    // Standard mode: find articles that are not yet in the database.
    const existingArticles = await Article.find({ link: { $in: scrapedLinks } }).select('link').lean();
    const existingLinks = new Set(existingArticles.map(a => a.link));
    
    const freshArticles = articles.filter(a => !existingLinks.has(a.link));
    logger.info(`Filtering complete. Found ${existingLinks.size} existing articles from previous runs, ${freshArticles.length} are fresh.`);
    return freshArticles;
}


/**
 * Saves all processed articles and synthesized events to the database in a single transactional operation.
 * @param {Array} articlesToSave - The array of all articles processed in the run.
 * @param {Array} eventsToSave - The array of synthesized events.
 * @returns {Promise<boolean>} A promise that resolves to true if successful.
 */
export async function savePipelineResults(articlesToSave, eventsToSave) {
    logger.info(`Committing pipeline results to database...`);
    
    const articleOps = [];

    if (articlesToSave && articlesToSave.length > 0) {
        for (const article of articlesToSave) {
            // If the article was fully enriched and assessed, generate a new, more accurate embedding based on its content.
            // Otherwise, its initial headline-based embedding is sufficient.
            if (article.relevance_article && article.articleContent) {
                const textToEmbed = `${article.headline}\n${article.assessment_article || ''}\n${(article.articleContent.contents || []).join(' ').substring(0, 500)}`;
                article.embedding = await generateEmbedding(textToEmbed);
            }

            const { _id, ...dataToSet } = article;
            Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);

            // --- CRITICAL CHANGE: Remove full article content before saving to database ---
            // The full text has already been used in memory for AI synthesis.
            // Persisting it is unnecessary and the primary cause of database bloat.
            delete dataToSet.articleContent;
            // --- END CRITICAL CHANGE ---

            articleOps.push({
                updateOne: {
                    filter: { link: article.link },
                    update: { $set: dataToSet },
                    upsert: true,
                },
            });
        }
    }

    try {
        if (articleOps.length > 0) {
            await Article.bulkWrite(articleOps, { ordered: false });
            logger.info(`Article commit complete. Upserted/Modified: ${articleOps.length}. (Full article content was NOT stored).`);
        }

        const eventOps = [];
        if (eventsToSave && eventsToSave.length > 0 && articleOps.length > 0) {
            for (const event of eventsToSave) {
                const sourceLinks = event.source_articles.map(sa => sa.link);
                const savedArticles = await Article.find({ link: { $in: sourceLinks } }).select('_id link').lean();
                const linkToIdMap = new Map(savedArticles.map(a => [a.link, a._id]));

                event.source_articles.forEach(sa => {
                    sa.article_id = linkToIdMap.get(sa.link);
                });
                event.source_articles = event.source_articles.filter(sa => sa.article_id);

                const eventPayload = event.toObject ? event.toObject() : event;

                eventOps.push({
                    updateOne: {
                        filter: { event_key: event.event_key },
                        update: { $set: eventPayload },
                        upsert: true,
                    }
                });
            }
        }

        if (eventOps.length > 0) {
            const eventResult = await SynthesizedEvent.bulkWrite(eventOps, { ordered: false });
            logger.info(`Event commit complete. Upserted: ${eventResult.upsertedCount}, Modified: ${eventResult.modifiedCount}.`);
        } else if (articlesToSave.length > 0) {
             logger.info('No new events to commit.');
        } else {
             logger.info('No new articles or events to commit.');
        }
        
        return true;

    } catch (error) {
        logger.fatal({ err: error }, 'CRITICAL: Failed to commit pipeline results to the database.');
        return false;
    }
}