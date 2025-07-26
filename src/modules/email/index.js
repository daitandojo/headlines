// src/modules/email/index.js (version 2.0)
import { logger } from '../../utils/logger.js';
import { performActualEmailSend, performActualSupervisorEmailSend } from './mailer.js';
import { ARTICLES_RELEVANCE_THRESHOLD, HEADLINES_RELEVANCE_THRESHOLD } from '../../config/index.js';
import { truncateString } from '../../utils/helpers.js';

/**
 * Determines which articles are suitable for the wealth events email and sends it.
 * Updates articles with email status.
 * @param {Array<Object>} processedArticles - Articles from the main pipeline.
 * @returns {Promise<Array<Object>>} Original articles array with updated email status fields.
 */
export async function sendWealthEventsEmail(processedArticles) {
    if (!Array.isArray(processedArticles) || processedArticles.length === 0) {
        logger.info('No articles provided to email coordinator. Skipping.');
        return processedArticles || [];
    }

    logger.info(`📧 Evaluating ${processedArticles.length} articles for wealth events email...`);

    const articlesForEmail = processedArticles.filter(article => {
        if (!article) return false;
        
        // Primary condition: Article content was successfully assessed and is relevant.
        const isArticleRelevant = article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD && !article.error;
        if (isArticleRelevant) return true;

        // Fallback condition: Headline was relevant, but content processing failed (e.g., insufficient content).
        // This ensures important leads aren't missed due to scraping issues.
        const isFallbackRelevant = article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD && article.error;
        if(isFallbackRelevant) {
             logger.debug(`Article "${truncateString(article.headline, 50)}" selected for email based on headline relevance due to content processing issue.`);
             return true;
        }

        return false;
    });

    if (articlesForEmail.length === 0) {
        logger.info('No articles met the criteria for the wealth events email.');
        return processedArticles.map(a => ({ ...a, emailed: false, email_skipped_reason: 'Did not meet criteria' }));
    }

    logger.info(`Sending ${articlesForEmail.length} articles in wealth events email.`);

    const sortedArticlesForEmail = [...articlesForEmail].sort((a, b) => {
        const scoreA = a.relevance_article ?? a.relevance_headline ?? 0;
        const scoreB = b.relevance_article ?? b.relevance_headline ?? 0;
        return scoreB - scoreA;
    });

    const sentResults = await performActualEmailSend(sortedArticlesForEmail);

    // Merge email status back into the main list
    const finalArticleSet = processedArticles.map(original => {
        const sentVersion = sentResults.find(sent => sent.link === original.link);
        if (sentVersion) {
            return { ...original, ...sentVersion }; // Apply status from mailer
        }
        if(!original.emailed) {
            return { ...original, emailed: false, email_skipped_reason: original.email_skipped_reason || 'Did not meet criteria' };
        }
        return original;
    });

    return finalArticleSet;
}

/**
 * Coordinates sending the supervisor report email.
 * @param {Array<Object>} allAssessedArticles - All articles processed in the run.
 * @param {Object} runStats - Statistics about the current pipeline run.
 */
export async function sendSupervisorReportEmail(allAssessedArticles, runStats) {
    if (!runStats) {
        logger.error('No runStats provided for supervisor report. Skipping email.');
        return;
    }
    
    logger.info('Preparing supervisor report email...');
    
    try {
        await performActualSupervisorEmailSend(allAssessedArticles, runStats);
        logger.info('✅ Supervisor report email successfully sent/queued.');
    } catch (error) {
        logger.error({ err: error }, '💥 CRITICAL: Failed to send supervisor report email.');
    }
}