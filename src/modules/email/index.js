// File: headlines_mongo/src/modules/email/index.js
import { getLogger } from '@daitanjs/development'; // Use DaitanJS central logger
import {
  performActualEmailSend, // Renamed for clarity, from mailer.js
  performActualSupervisorEmailSend, // Renamed for clarity, from mailer.js
} from './mailer.js'; // Assuming mailer.js is correctly set up
import {
  ARTICLES_RELEVANCE_THRESHOLD, // App-specific config
  HEADLINES_RELEVANCE_THRESHOLD, // App-specific config
} from '../../config/index.js'; // Main app config index
import { truncateString } from '@daitanjs/utilities'; // DaitanJS utility

const logger = getLogger('headlines-mongo-email-coordinator'); // App-namespaced logger

/**
 * Determines which articles are suitable for the wealth events email and sends it.
 * Updates articles with email status.
 * @param {Array<Object>} processedArticles - Articles from the main pipeline.
 * @returns {Promise<Array<Object>>} Original articles array with updated email status fields.
 */
export async function sendWealthEventsEmail(processedArticles) {
  const emailType = 'Wealth Events';
  if (!Array.isArray(processedArticles)) {
    logger.warn(
      `[${emailType} Coordinator] Input is not an array. Skipping email. Type: ${typeof processedArticles}`
    );
    return []; // Return empty array for invalid input
  }
  if (processedArticles.length === 0) {
    logger.info(
      `[${emailType} Coordinator] No articles provided after pipeline. Nothing to email.`
    );
    return [];
  }

  logger.info(
    `📧 [${emailType} Coordinator] Evaluating ${processedArticles.length} candidate articles...`
  );

  const articlesForEmail = processedArticles.filter((article) => {
    if (!article || typeof article !== 'object') return false;

    // Determine if the article should be sent based on relevance and error states
    const hasContentProcessingError = !!(
      article.error &&
      article.error !== 'Insufficient content' &&
      !article.error.toLowerCase().includes('ai error')
    );
    const hasEnrichmentError = !!article.enrichment_error;
    const isContentInsufficient = article.error === 'Insufficient content';
    const hasAiContentError = !!(
      article.error && article.error.toLowerCase().includes('ai error')
    ); // Specific check for AI errors during content assessment

    // Can we trust the article content assessment?
    const canAssessContent =
      !hasContentProcessingError &&
      !hasEnrichmentError &&
      !isContentInsufficient &&
      !hasAiContentError;

    let sendThisArticle = false;
    if (canAssessContent && typeof article.relevance_article === 'number') {
      if (article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD) {
        sendThisArticle = true;
      }
    } else if (typeof article.relevance_headline === 'number') {
      // Fallback to headline relevance if content issues
      // Send if headline is relevant AND there was some issue with content processing
      // (enrichment error, insufficient content for AI, or an AI error during content assessment)
      if (
        article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD &&
        (hasContentProcessingError ||
          hasEnrichmentError ||
          isContentInsufficient ||
          hasAiContentError)
      ) {
        sendThisArticle = true;
        logger.debug(
          `[${emailType} Coordinator] Article "${truncateString(
            article.headline,
            50
          )}" selected for email based on headline relevance due to content processing issue. Error: ${
            article.error
          }, EnrichmentError: ${article.enrichment_error}`
        );
      }
    }
    return sendThisArticle;
  });

  if (articlesForEmail.length === 0) {
    logger.info(
      `[${emailType} Coordinator] No articles met specific criteria for ${emailType} notification in this run.`
    );
    // Still map over original articles to ensure all have email status fields
    return processedArticles.map((originalArticle) => ({
      ...originalArticle,
      emailed: originalArticle.emailed || false, // Preserve existing emailed status if any
      email_error: originalArticle.email_error || null,
      email_skipped_reason:
        originalArticle.email_skipped_reason ||
        'Did not meet wealth events email criteria in this run.',
    }));
  }

  logger.info(
    `[${emailType} Coordinator] Filtered down to ${articlesForEmail.length} articles for email content.`
  );

  // Sort articles for the email (e.g., by relevance)
  const sortedArticlesForEmail = [...articlesForEmail].sort((a, b) => {
    const aHadContentIssue = !!(a.error || a.enrichment_error); // Considers any processing/enrichment error a content issue for sorting
    const bHadContentIssue = !!(b.error || b.enrichment_error);

    // Prioritize fully processed, relevant articles first, then headline-relevant with content issues
    const aScore = aHadContentIssue
      ? a.relevance_headline || 0
      : (a.relevance_article || 0) + 500; // Boost for successfully assessed content
    const bScore = bHadContentIssue
      ? b.relevance_headline || 0
      : (b.relevance_article || 0) + 500;

    if (bScore !== aScore) return bScore - aScore;
    // If scores are similar, prefer successfully assessed content over those with issues
    if (!aHadContentIssue && bHadContentIssue) return -1;
    if (aHadContentIssue && !bHadContentIssue) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0); // Fallback sort by update time if available
  });

  logger.info(
    `\n📰 [${emailType} Coordinator] Articles selected for Email (Top 5 shown, or all if fewer):`
  );
  sortedArticlesForEmail.slice(0, 5).forEach((article, index) => {
    const scoreType =
      article.error || article.enrichment_error ? 'Headline' : 'Content';
    const score =
      article.error || article.enrichment_error
        ? article.relevance_headline
        : article.relevance_article;
    logger.info(
      `${index + 1}. "${truncateString(
        String(article.headline ?? 'N/A'),
        50
      )}" (${article.newspaper ?? 'N/A'}) - ${scoreType} Score: ${
        score ?? 'N/A'
      }`
    );
  });
  if (sortedArticlesForEmail.length > 5)
    logger.info(`... and ${sortedArticlesForEmail.length - 5} more.`);

  try {
    // Call the mailer function (which uses @daitanjs/communication)
    const articlesActuallySentToMailer = await performActualEmailSend(
      sortedArticlesForEmail
    ); // This function in mailer.js should return the articles with their send status

    const successfullyEmailedCount = articlesActuallySentToMailer.filter(
      (a) => a.emailed
    ).length;
    if (successfullyEmailedCount > 0) {
      logger.info(
        `✅ [${emailType} Coordinator] Mailer service processed email for ${successfullyEmailedCount} articles successfully.`
      );
    } else {
      logger.info(
        `📧 [${emailType} Coordinator] Mailer service processed ${articlesActuallySentToMailer.length} articles, but no email was sent or none were marked as successfully emailed by the mailer.`
      );
    }

    // Merge the email status from articlesActuallySentToMailer back into the full processedArticles list
    const finalArticleSetWithStatus = processedArticles.map(
      (originalArticle) => {
        const mailedVersion = articlesActuallySentToMailer.find(
          (sentArticle) => sentArticle.link === originalArticle.link
        );
        if (mailedVersion) {
          return { ...originalArticle, ...mailedVersion }; // Override with status from mailer
        }
        // If not in articlesActuallySentToMailer, it means it wasn't selected for email or failed before mailer
        if (
          !articlesForEmail.find((afe) => afe.link === originalArticle.link)
        ) {
          return {
            ...originalArticle,
            emailed: originalArticle.emailed || false,
            email_skipped_reason:
              originalArticle.email_skipped_reason ||
              'Did not meet wealth events email criteria in this run.',
          };
        }
        // Default if it was a candidate but somehow not in mailer results (shouldn't happen if mailer returns all candidates)
        return {
          ...originalArticle,
          emailed: false,
          email_error:
            originalArticle.email_error ||
            'Not processed by mailer despite being a candidate.',
        };
      }
    );
    return finalArticleSetWithStatus;
  } catch (error) {
    logger.error(
      `💥 CRITICAL: [${emailType} Coordinator] Error during email sending process via mailer.js:`,
      { errorMessage: error.message, stack: error.stack?.substring(0, 500) }
    );
    return processedArticles.map((originalArticle) => ({
      ...originalArticle,
      emailed: false,
      email_error: `Coordinator/Mailer error: ${truncateString(
        error.message,
        100
      )}`,
    }));
  }
}

/**
 * Coordinates sending the supervisor report email.
 * @param {Array<Object>} allAssessedFreshHeadlines - All headlines assessed, with their status.
 * @param {Object} runStats - Statistics about the current pipeline run.
 */
export async function sendSupervisorReportEmail(
  allAssessedFreshHeadlines,
  runStats
) {
  const emailType = 'Supervisor Report';
  if (!Array.isArray(allAssessedFreshHeadlines)) {
    // Basic check for the array itself
    logger.error(
      `[${emailType} Coordinator] Invalid allAssessedFreshHeadlines (not an array). Supervisor email cannot be sent.`
    );
    return; // Cannot proceed
  }
  if (!runStats || typeof runStats !== 'object') {
    logger.warn(
      `[${emailType} Coordinator] Invalid or missing runStats. Supervisor email content might be incomplete.`
    );
    runStats = runStats || { warning: 'Run statistics were not available.' }; // Ensure runStats is an object
  }

  logger.info(
    `📧 [${emailType} Coordinator] Preparing supervisor report for ${allAssessedFreshHeadlines.length} assessed headlines and run stats.`
  );

  try {
    // Call the mailer function (which uses @daitanjs/communication)
    const emailResult = await performActualSupervisorEmailSend(
      allAssessedFreshHeadlines,
      runStats
    );

    if (emailResult && emailResult.sent) {
      logger.info(
        `✅ [${emailType} Coordinator] Mailer service successfully sent/queued supervisor email.`
      );
    } else if (emailResult && emailResult.reason) {
      logger.info(
        `ℹ️ [${emailType} Coordinator] Supervisor email not sent by mailer. Reason: ${emailResult.reason}`
      );
    } else {
      logger.warn(
        `⚠️ [${emailType} Coordinator] Supervisor email status from mailer was inconclusive or failed silently (result: ${JSON.stringify(
          emailResult
        )}).`
      );
    }
  } catch (error) {
    logger.error(
      `💥 CRITICAL: [${emailType} Coordinator] Error during supervisor email sending process via mailer.js:`,
      {
        errorMessage: error.message,
        stack: error.stack?.substring(0, 500),
      }
    );
    // No articles to update status on here, just log the failure.
  }
}
