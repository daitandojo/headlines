// src/modules/mongoStore/index.js (version 1.0)
import Article from '../../../models/Article.js';
import { logger } from '../../utils/logger.js';
import { truncateString } from '../../utils/helpers.js';
import { MIN_HEADLINE_CHARS, MAX_HEADLINE_CHARS } from '../../config/index.js';

function validateInitialArticle(article) {
    if (!article || typeof article !== 'object') return 'Article object is invalid.';
    if (!article.headline || article.headline.length < MIN_HEADLINE_CHARS) return `Headline is too short (min ${MIN_HEADLINE_CHARS}).`;
    if (article.headline.length > MAX_HEADLINE_CHARS) return `Headline is too long (max ${MAX_HEADLINE_CHARS}).`;
    if (!article.link || !article.link.startsWith('http')) return 'Link is invalid.';
    if (!article.newspaper) return 'Newspaper field is missing.';
    if (typeof article.relevance_headline !== 'number') return 'relevance_headline is missing.';
    return null;
}

export async function filterFreshArticles(articles) {
    if (!articles || articles.length === 0) return [];
    
    const links = articles.map(a => a.link);
    const existingArticles = await Article.find({ link: { $in: links } }).select('link').lean();
    const existingLinks = new Set(existingArticles.map(a => a.link));
    
    const freshArticles = articles.filter(a => !existingLinks.has(a.link));
    logger.info(`Filtering complete. Found ${existingLinks.size} existing articles, ${freshArticles.length} are fresh.`);
    return freshArticles;
}

export async function storeInitialHeadlineData(articles) {
    const operations = [];
    const articlesWithStatus = articles.map(article => {
        const validationError = validateInitialArticle(article);
        if (validationError) {
            logger.warn(`Initial validation failed for "${article.headline}": ${validationError}`);
            return { ...article, storage_error_initial_headline_data: validationError };
        }

        operations.push({
            updateOne: {
                filter: { link: article.link },
                update: {
                    $set: {
                        headline: article.headline,
                        link: article.link,
                        newspaper: article.newspaper,
                        source: article.source,
                        relevance_headline: article.relevance_headline,
                        assessment_headline: article.assessment_headline,
                        raw: article.raw,
                    },
                    $setOnInsert: { createdAt: new Date() }
                },
                upsert: true,
            },
        });
        return { ...article, storage_error_initial_headline_data: null };
    });

    if (operations.length > 0) {
        try {
            logger.info(`Storing initial data for ${operations.length} headlines via bulk write.`);
            await Article.bulkWrite(operations);
        } catch (error) {
            logger.error({ err: error }, 'Bulk write operation failed for initial data.');
            // This is a broad error assignment, but sufficient for supervisor report
            return articlesWithStatus.map(a => ({ ...a, storage_error_initial_headline_data: 'Bulk DB operation failed.' }));
        }
    }

    return articlesWithStatus;
}


export async function updateArticlesWithFullData(articles) {
    const operations = articles.map(article => {
        const { link, ...dataToSet } = article;
        // Clean up data to avoid storing undefined values
        Object.keys(dataToSet).forEach(key => dataToSet[key] === undefined && delete dataToSet[key]);

        return {
            updateOne: {
                filter: { link: article.link },
                update: { $set: dataToSet },
            },
        };
    });

    if (operations.length > 0) {
        try {
            logger.info(`Updating ${operations.length} articles with full data via bulk write.`);
            await Article.bulkWrite(operations);
            return articles.map(a => ({...a, db_operation_status: 'updated'}));
        } catch (error) {
            logger.error({ err: error }, 'Bulk write operation failed for final data update.');
            return articles.map(a => ({...a, db_operation_status: 'failed', db_error_reason: 'Bulk DB op failed.' }));
        }
    }
    return [];
}