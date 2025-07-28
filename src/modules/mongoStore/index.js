// src/modules/mongoStore/index.js
import Article from '../../../models/Article.js';
import { logger } from '../../utils/logger.js';
import { truncateString } from '../../utils/helpers.js';
import { generateEmbedding } from '../../utils/vectorUtils.js';
import { MIN_HEADLINE_CHARS, MAX_HEADLINE_CHARS, IS_REFRESH_MODE } from '../../config/index.js';

function validateInitialArticle(article) {
    if (!article || typeof article !== 'object') return 'Article object is invalid.';
    // In refresh mode, the article is already validated.
    if (article._id && IS_REFRESH_MODE) return null;
    
    if (!article.headline || article.headline.length < MIN_HEADLINE_CHARS) return `Headline is too short (min ${MIN_HEADLINE_CHARS}).`;
    if (article.headline.length > MAX_HEADLINE_CHARS) return `Headline is too long (max ${MAX_HEADLINE_CHARS}).`;
    if (!article.link || !article.link.startsWith('http')) return 'Link is invalid.';
    if (!article.newspaper) return 'Newspaper field is missing.';
    return null;
}

export async function filterFreshArticles(articles) {
    if (!articles || articles.length === 0) return [];

    if (IS_REFRESH_MODE) {
        logger.warn('REFRESH MODE: Re-fetching all scraped articles from DB to re-process.');
        const links = articles.map(a => a.link);
        const refreshedArticles = await Article.find({ link: { $in: links } }).lean();
        logger.info(`Found ${refreshedArticles.length} existing articles to refresh.`);
        return refreshedArticles;
    }
    
    const links = articles.map(a => a.link);
    const existingArticles = await Article.find({ link: { $in: links } }).select('link').lean();
    const existingLinks = new Set(existingArticles.map(a => a.link));
    
    const freshArticles = articles.filter(a => !existingLinks.has(a.link));
    logger.info(`Filtering complete. Found ${existingLinks.size} existing articles, ${freshArticles.length} are fresh.`);
    return freshArticles;
}

export async function prepareArticlesForPipeline(articles) {
    const articlesToProcess = [];
    
    for (const article of articles) {
        const validationError = validateInitialArticle(article);
        if (validationError) {
            logger.warn(`Initial validation failed for "${truncateString(article.headline, 50)}": ${validationError}`);
            continue;
        }
        articlesToProcess.push(article);
    }

    if (articlesToProcess.length === 0) {
        logger.info('No valid new or refreshed articles to prepare for the pipeline.');
        return [];
    }

    const operations = [];
    for (const article of articlesToProcess) {
        // Only generate a new embedding if it's a new article. Refreshed articles already have one.
        let embedding = article.embedding;
        if (!embedding) {
            const textToEmbed = article.headline;
            embedding = await generateEmbedding(textToEmbed);
        }

        const updatePayload = {
            ...article,
            embedding,
            // Reset assessment fields for a fresh run
            relevance_headline: 0,
            assessment_headline: 'Awaiting assessment',
            relevance_article: null,
            assessment_article: null,
            key_individuals: [],
            error: null,
            enrichment_error: null,
        };
        // Remove _id from the payload to avoid immutable field errors on upsert
        delete updatePayload._id; 

        operations.push({
            updateOne: {
                filter: { link: article.link },
                update: { $set: updatePayload },
                upsert: true
            }
        });
    }

    try {
        logger.info(`Preparing ${operations.length} articles in the database for processing...`);
        const bulkResult = await Article.bulkWrite(operations);
        logger.info(`DB Prep complete. Upserted: ${bulkResult.upsertedCount}, Modified: ${bulkResult.modifiedCount}`);

        const links = articlesToProcess.map(a => a.link);
        const finalDocs = await Article.find({ link: { $in: links } }).lean();
        return finalDocs;
    } catch (error) {
        logger.error({ err: error }, 'Bulk upsert operation failed during article preparation.');
        return [];
    }
}

export async function updateArticlesWithFullData(articles) {
    if (articles.length === 0) return [];

    const operations = [];
    for (const article of articles) {
        const { _id, ...dataToSet } = article;
        Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);
        
        const textToEmbed = `${article.headline}\n${article.assessment_article || ''}\n${(article.articleContent?.contents || []).join(' ').substring(0, 500)}`;
        dataToSet.embedding = await generateEmbedding(textToEmbed);

        operations.push({
            updateOne: {
                filter: { _id: article._id },
                update: { $set: dataToSet },
            },
        });
    }

    if (operations.length > 0) {
        try {
            logger.info(`Updating ${operations.length} articles with full data and new embeddings.`);
            await Article.bulkWrite(operations, { ordered: false });
            return articles.map(a => ({...a, db_operation_status: 'updated'}));
        } catch (error) {
            logger.error({ err: error }, 'Bulk write operation failed for final data update.');
            return articles.map(a => ({...a, db_operation_status: 'failed', db_error_reason: 'Bulk DB op failed.' }));
        }
    }
    return [];
}