// File: headlines_mongo/src/modules/assessments/assessArticles.js
import { getLogger } from '@daitanjs/development';
import pLimit from 'p-limit';
import {
  ARTICLES_RELEVANCE_THRESHOLD,
  MIN_ARTICLE_CHARS,
  CONCURRENCY_LIMIT,
  APP_LLM_PROVIDER_ARTICLES,
  APP_LLM_MODEL_ARTICLES,
} from '../../config/index.js';
import { truncateString, retryWithBackoff } from '@daitanjs/utilities';
import { analyzeArticleContentWithAI } from './aiAnalyzer.js';

const logger = getLogger('headlines-mongo-assess-articles');
const MAX_AI_RETRIES_PER_ARTICLE = 1;

/**
 * Extracts and concatenates text content from the articleContent object.
 */
function getTotalExtractedText(articleContent = {}) {
  if (typeof articleContent !== 'object' || articleContent === null) {
    return '';
  }
  return Object.values(articleContent)
    .reduce((acc, val) => acc.concat(Array.isArray(val) ? val : []), [])
    .filter((text) => typeof text === 'string' && text.trim() !== '')
    .join(' \n\n ');
}

/**
 * Processes a single article for content assessment. This is the core logical unit.
 * @param {object} article - The article to process.
 * @param {number} index - The index for logging.
 * @param {number} totalArticles - The total number of articles for logging.
 * @returns {Promise<object>} The processed article with assessment results.
 */
async function processSingleArticle(article, index, totalArticles) {
  const progress = `[${index + 1}/${totalArticles}]`;

  // Initial validation of the article object itself
  if (
    !article ||
    typeof article !== 'object' ||
    !article.headline ||
    !article.link
  ) {
    logger.warn(
      `assessArrayOfArticles: ${progress} Invalid article structure. Skipping.`
    );
    return {
      ...(article || {}),
      relevance_article: 0,
      assessment_article: 'Invalid article data.',
      error: 'Invalid article data structure.',
    };
  }

  const articleDisplayInfo = `"${truncateString(article.headline, 50)}" (URL: ${
    article.link
  })`;

  // If a prior, critical error exists, skip AI assessment and preserve the error.
  if (
    article.error &&
    article.error !== 'Insufficient content' &&
    !article.enrichment_error
  ) {
    logger.warn(
      `${progress} Article ${articleDisplayInfo} has prior critical error. Skipping AI content assessment.`
    );
    return {
      ...article,
      relevance_article: 0,
      assessment_article: `Skipped due to prior error: ${article.error}`,
    };
  }

  const totalExtractedText = getTotalExtractedText(article.articleContent);
  const actualContentLengthForAI = totalExtractedText.length;

  // If content is insufficient, flag it and return. No AI call needed.
  if (actualContentLengthForAI < MIN_ARTICLE_CHARS) {
    logger.info(
      `${progress} Article ${articleDisplayInfo} has insufficient content (${actualContentLengthForAI} chars). Skipping AI.`
    );
    return {
      ...article,
      relevance_article: 0,
      assessment_article: 'Insufficient content for AI analysis.',
      error: 'Insufficient content', // Set or overwrite the error to the most accurate current status.
    };
  }

  // If we reach here, we are proceeding with an AI call.
  logger.info(
    `💬 ${progress} Analyzing content for: ${articleDisplayInfo} (Length: ${actualContentLengthForAI} chars)`
  );

  try {
    const assessmentResult = await retryWithBackoff(
      () => analyzeArticleContentWithAI(article),
      MAX_AI_RETRIES_PER_ARTICLE,
      {
        loggerInstance: logger,
        operationName: `Article Content AI for ${truncateString(
          article.link,
          30
        )}`,
      }
    );

    // --- DEFINITIVE FIX: Clear, explicit state update upon success ---
    // If the AI call succeeds, it means the content was valid and analyzable.
    // Any previous, less-severe errors (like 'Insufficient content' or an enrichment error)
    // are now superseded by this successful analysis. We can confidently clear them.
    return {
      ...article,
      ...assessmentResult, // Merge in new relevance, assessment, etc.
      error: assessmentResult.error || null, // Use the error from AI if any, otherwise clear it.
      enrichment_error: null, // A successful content assessment means enrichment ultimately worked.
    };
  } catch (aiCallError) {
    // This catch block handles failures from retryWithBackoff (i.e., the AI call itself failed).
    logger.error(
      `❌ ${progress} AI content assessment failed for ${articleDisplayInfo} after retries: ${aiCallError.message}`
    );
    return {
      ...article,
      relevance_article: 0,
      assessment_article: `AI assessment failed: ${aiCallError.message}`,
      // Set the error to the new, more specific failure reason.
      error: `Content assessment AI error: ${truncateString(
        aiCallError.message,
        100
      )}`,
    };
  }
}

/**
 * Assesses an array of article objects for relevance based on their content.
 */
export async function assessArrayOfArticles(articleObjects) {
  if (!Array.isArray(articleObjects) || articleObjects.length === 0) {
    logger.warn(
      'assessArrayOfArticles: No articles provided for content assessment.'
    );
    return [];
  }

  const effectiveConcurrency =
    typeof CONCURRENCY_LIMIT === 'number' && CONCURRENCY_LIMIT > 0
      ? CONCURRENCY_LIMIT
      : 3;

  logger.info(
    `🔎 Assessing content of ${articleObjects.length} articles. Concurrency: ${effectiveConcurrency}. Min Chars: ${MIN_ARTICLE_CHARS}. LLM: ${APP_LLM_PROVIDER_ARTICLES}/${APP_LLM_MODEL_ARTICLES}.`
  );

  const limit = pLimit(effectiveConcurrency);
  const assessmentPromises = articleObjects.map((article, index) =>
    limit(() => processSingleArticle(article, index, articleObjects.length))
  );

  // --- BEST PRACTICE IMPROVEMENT: Use Promise.allSettled for robustness ---
  const settledResults = await Promise.allSettled(assessmentPromises);
  const processedArticles = settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // This handles unexpected errors within processSingleArticle that weren't caught.
    const originalArticle = articleObjects[index];
    const reason = result.reason?.message || String(result.reason);
    logger.error(
      `A promise for article "${originalArticle.headline}" was rejected: ${reason}`
    );
    return {
      ...originalArticle,
      relevance_article: 0,
      assessment_article: 'Critical processing error.',
      error: `Critical error: ${reason}`,
    };
  });

  logArticleAssessmentSummary(processedArticles);
  return processedArticles;
}

// Helper function for summary logging (no changes needed here)
function logArticleAssessmentSummary(processedArticles) {
  const successfullyAssessedContent = processedArticles.filter(
    (a) =>
      a &&
      !a.error &&
      a.relevance_article !== undefined &&
      a.relevance_article !== null
  );
  const relevantByContent = successfullyAssessedContent.filter(
    (a) => a.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD
  );
  const erroredDuringAI = processedArticles.filter(
    (a) => a && a.error && a.error.toLowerCase().includes('ai error')
  ).length;
  const insufficientContentCount = processedArticles.filter(
    (a) => a && a.error === 'Insufficient content'
  ).length;

  logger.info('\n🧠 AI Full Content Analysis Log (attempted in this step):');
  processedArticles.forEach((article, i) => {
    if (!article) {
      logger.warn(`  ${i + 1}. Invalid article object at index ${i}.`);
      return;
    }
    const scoreLog =
      article.relevance_article !== undefined &&
      article.relevance_article !== null
        ? `[${article.relevance_article}]`
        : '[N/A]';
    const errorMsg = article.error
      ? ` | Error: ${truncateString(article.error, 60)}`
      : '';
    const assessmentText =
      article.assessment_article ||
      (article.error === 'Insufficient content'
        ? 'Insufficient content'
        : 'No assessment text.');
    logger.info(
      `  ${i + 1}. ${scoreLog} "${truncateString(
        article.headline,
        40
      )}..." → "${truncateString(assessmentText, 60)}"${errorMsg}`
    );
  });

  logger.info('\n📊 Article Content Assessment Summary:');
  logger.info(`   - Total articles submitted: ${processedArticles.length}`);
  logger.info(
    `   - Successfully AI-assessed: ${successfullyAssessedContent.length}`
  );
  logger.info(
    `   - Passed content relevance threshold (>=${ARTICLES_RELEVANCE_THRESHOLD}): ${relevantByContent.length}`
  );
  logger.info(
    `   - Skipped due to insufficient content: ${insufficientContentCount}`
  );
  logger.info(`   - Errors during AI calls: ${erroredDuringAI}`);

  if (successfullyAssessedContent.length > 0) {
    const relevanceRate = (
      (relevantByContent.length / successfullyAssessedContent.length) *
      100
    ).toFixed(2);
    logger.info(
      `   - Content relevance rate (of assessed): ${
        relevanceRate > 0 ? relevanceRate : '0.00'
      }%`
    );

    const topArticlesByContent = [...successfullyAssessedContent]
      .sort((a, b) => (b.relevance_article || 0) - (a.relevance_article || 0))
      .slice(0, 5);

    if (
      topArticlesByContent.length > 0 &&
      (topArticlesByContent[0].relevance_article || 0) > 0
    ) {
      logger.info(
        `🏆 Top ${topArticlesByContent.length} articles by content relevance:`
      );
      topArticlesByContent.forEach((article, i) => {
        logger.info(
          `  ${i + 1}. [${article.relevance_article}] "${truncateString(
            article.headline,
            60
          )}" (Source: ${article.newspaper || article.source || 'N/A'})`
        );
      });
    } else {
      logger.info('🏅 No articles scored >0 for content relevance.');
    }
  } else {
    logger.info('🏅 No articles were successfully AI-assessed for content.');
  }
}
