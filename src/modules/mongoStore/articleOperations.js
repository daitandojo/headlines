// File: headlines_mongo/src/modules/mongoStore/articleOperations.js
import { getLogger } from '@daitanjs/development';
import Article from '../../../models/Article.js';
import {
  filterNewDocumentsByField,
  executeBulkWrite,
  upsertOneWithRetry as libUpsertOneWithRetry,
} from '@daitanjs/data';
import {
  MAX_APP_RETRIES,
  APP_RETRY_DELAY_MS,
  MIN_HEADLINE_CHARS,
  MAX_HEADLINE_CHARS,
  MAX_ARTICLE_CHARS,
} from '../../config/index.js';
import { truncateString } from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-store');

function validateArticleForApp(article, stage = 'initial') {
  if (!article || typeof article !== 'object') {
    return {
      isValid: false,
      reason: 'Article object is null or not an object.',
    };
  }
  if (
    !article.headline ||
    typeof article.headline !== 'string' ||
    article.headline.trim().length < MIN_HEADLINE_CHARS
  ) {
    return {
      isValid: false,
      reason: `Headline missing, invalid, or too short (min ${MIN_HEADLINE_CHARS} chars). Found: "${truncateString(
        String(article.headline ?? ''),
        30
      )}"`,
    };
  }
  if (article.headline.length > MAX_HEADLINE_CHARS) {
    return {
      isValid: false,
      reason: `Headline too long (max ${MAX_HEADLINE_CHARS} chars). Length: ${article.headline.length}`,
    };
  }
  if (
    !article.link ||
    typeof article.link !== 'string' ||
    !article.link.startsWith('http')
  ) {
    return {
      isValid: false,
      reason: 'Link missing, invalid, or not starting with http(s).',
    };
  }
  // Both newspaper and source should be present due to formatScrapedLinkData
  if (!article.newspaper || typeof article.newspaper !== 'string') {
    return { isValid: false, reason: 'Field "newspaper" missing or invalid.' };
  }
  if (!article.source || typeof article.source !== 'string') {
    return { isValid: false, reason: 'Field "source" missing or invalid.' };
  }

  if (typeof article.relevance_headline !== 'number') {
    return {
      isValid: false,
      reason: 'relevance_headline score missing or invalid.',
    };
  }
  if (
    !article.assessment_headline ||
    typeof article.assessment_headline !== 'string'
  ) {
    return {
      isValid: false,
      reason: 'assessment_headline text missing or invalid.',
    };
  }

  if (stage === 'final') {
    if (
      article.articleContent &&
      Array.isArray(article.articleContent.contents)
    ) {
      const contentLength = article.articleContent.contents.join(' ').length;
      if (contentLength > MAX_ARTICLE_CHARS) {
        return {
          isValid: false,
          reason: `Article content too long (max ${MAX_ARTICLE_CHARS} chars). Length: ${contentLength}`,
        };
      }
    }
    const hasMeaningfulContent =
      article.articleContent &&
      Object.keys(article.articleContent).length > 0 &&
      Array.isArray(article.articleContent.contents) &&
      article.articleContent.contents.join('').trim().length > 0;
    const noProcessingError = !article.error && !article.enrichment_error;
    if (hasMeaningfulContent && noProcessingError) {
      if (typeof article.relevance_article !== 'number') {
        return {
          isValid: false,
          reason:
            'relevance_article score missing for successfully enriched content.',
        };
      }
      if (
        !article.assessment_article ||
        typeof article.assessment_article !== 'string' ||
        article.assessment_article.trim() === ''
      ) {
        return {
          isValid: false,
          reason:
            'assessment_article text missing or empty for successfully enriched content.',
        };
      }
    }
  }
  return { isValid: true };
}

export async function filterFreshArticles(articleObjects) {
  if (!Array.isArray(articleObjects) || articleObjects.length === 0) {
    logger.warn(
      'filterFreshArticles: No articles provided. Returning empty array.'
    );
    return [];
  }
  logger.info(
    `🔹 Starting freshness filtering for ${articleObjects.length} articles using @daitanjs/data utility...`
  );
  try {
    const freshArticles = await filterNewDocumentsByField(
      Article,
      articleObjects,
      'link',
      { loggerInstance: logger }
    );
    return freshArticles;
  } catch (error) {
    logger.error(
      `filterFreshArticles: Error using library utility: ${error.message}`,
      { stack: error.stack?.substring(0, 500) }
    );
    logger.warn(
      'filterFreshArticles: Database query failed during freshness check via library. Returning no fresh articles to be safe.'
    );
    return [];
  }
}

export async function storeInitialHeadlineData(freshAssessedArticles) {
  if (
    !Array.isArray(freshAssessedArticles) ||
    freshAssessedArticles.length === 0
  ) {
    logger.warn(
      'storeInitialHeadlineData: No articles provided. Returning empty array.'
    );
    return [];
  }
  logger.info(
    `🗂️  Preparing initial headline data for ${freshAssessedArticles.length} fresh articles for bulk store via @daitanjs/data...`
  );
  const operations = [];
  const articlesWithStatus = freshAssessedArticles.map((article) => ({
    ...article,
    storage_error_initial_headline_data: null,
  }));

  for (const article of articlesWithStatus) {
    const validation = validateArticleForApp(article, 'initial'); // `newspaper` and `source` fields are now expected from fetchHeadlines
    if (!validation.isValid) {
      logger.warn(
        `storeInitialHeadlineData: Article validation failed for initial store: ${validation.reason}`,
        { headline: article.headline, link: article.link }
      );
      article.storage_error_initial_headline_data = `Validation failed: ${validation.reason}`;
      continue;
    }
    const initialData = {
      headline: article.headline,
      link: article.link,
      newspaper: article.newspaper, // This should be present now
      source: article.source, // This should be present now
      relevance_headline: article.relevance_headline,
      assessment_headline: article.assessment_headline,
      section: article.section,
      author: article.author,
      published: article.published,
      position: article.position,
      raw: article.raw,
      topic: truncateString(article.headline, 80),
      relevance_article: null,
      assessment_article: 'Pending full content assessment.',
      articleContent: {},
      error: article.error || null,
    };
    Object.keys(initialData).forEach(
      (key) => initialData[key] === undefined && delete initialData[key]
    );
    operations.push({
      updateOne: {
        filter: { link: article.link },
        update: { $set: initialData, $setOnInsert: { createdAt: new Date() } },
        upsert: true,
      },
    });
  }

  if (operations.length > 0) {
    try {
      logger.info(
        `Attempting to store/update ${operations.length} initial headline data entries via bulk write.`
      );
      const bulkResult = await executeBulkWrite(Article, operations, {
        loggerInstance: logger,
      });
      if (bulkResult.hasWriteErrors()) {
        logger.error(
          'storeInitialHeadlineData: Bulk write operation completed with errors.',
          { errors: bulkResult.getWriteErrors() }
        );
        articlesWithStatus.forEach((article) => {
          if (
            operations.some(
              (op) => op.updateOne.filter.link === article.link
            ) &&
            !article.storage_error_initial_headline_data
          ) {
            article.storage_error_initial_headline_data = `Bulk DB operation had write errors. See logs.`;
          }
        });
      } else {
        logger.info(
          `Initial headline data bulk upsert processed ${operations.length} operations successfully.`
        );
      }
    } catch (error) {
      logger.error(
        `storeInitialHeadlineData: Error during bulk storing via library: ${error.message}`,
        { stack: error.stack?.substring(0, 500) }
      );
      articlesWithStatus.forEach((article) => {
        if (
          operations.some((op) => op.updateOne.filter.link === article.link) &&
          !article.storage_error_initial_headline_data
        ) {
          article.storage_error_initial_headline_data = `Bulk DB operation failed: ${error.message}`;
        }
      });
    }
  } else {
    logger.info(
      'No valid operations to perform for storing initial headline data.'
    );
  }
  const failureCount = articlesWithStatus.filter(
    (p) => p.storage_error_initial_headline_data
  ).length;
  logger.info(
    `🗂️  Initial headline data storage preparation complete. Articles with validation/DB errors: ${failureCount} out of ${freshAssessedArticles.length}.`
  );
  return articlesWithStatus;
}

export async function storeRelevantArticles(articlesForFinalStore) {
  // This function remains largely the same, assuming validateArticleForApp now correctly checks
  // for newspaper and source which are populated by the updated fetchHeadlines->formatScrapedLinkData.
  if (
    !Array.isArray(articlesForFinalStore) ||
    articlesForFinalStore.length === 0
  ) {
    logger.warn(
      'storeRelevantArticles: No articles provided for final store. Returning empty array.'
    );
    return [];
  }
  logger.info(
    `💾 Processing ${articlesForFinalStore.length} articles for final storage/update via @daitanjs/data...`
  );
  const results = [];
  for (const article of articlesForFinalStore) {
    if (!article || !article.link || !article.headline) {
      logger.warn(
        'storeRelevantArticles: Skipping invalid article object for final store.',
        { articlePreview: truncateString(JSON.stringify(article), 100) }
      );
      results.push({
        ...article,
        db_operation_status: 'skipped_invalid_data',
        db_error_reason: 'Invalid article object for final store.',
      });
      continue;
    }
    const validation = validateArticleForApp(article, 'final');
    if (!validation.isValid) {
      logger.warn(
        `storeRelevantArticles: Article validation failed for final store: ${validation.reason}`,
        { headline: article.headline, link: article.link }
      );
      results.push({
        ...article,
        db_operation_status: 'skipped_validation_failure',
        db_error_reason: `Validation: ${validation.reason}`,
      });
      continue;
    }
    const { _id, createdAt, updatedAt, ...dataToStore } = article;
    const articleDataForStorage = {
      ...dataToStore,
      topic: article.topic || truncateString(article.headline, 80),
      relevance_article:
        typeof article.relevance_article === 'number'
          ? article.relevance_article
          : null,
      assessment_article:
        article.assessment_article ||
        'Assessment not available or content not processed.',
      error: article.error || article.enrichment_error || null,
    };
    Object.keys(articleDataForStorage).forEach(
      (key) =>
        articleDataForStorage[key] === undefined &&
        delete articleDataForStorage[key]
    );
    try {
      const upsertResult = await libUpsertOneWithRetry(
        Article,
        { link: article.link },
        articleDataForStorage,
        {
          loggerInstance: logger,
          maxRetries: MAX_APP_RETRIES,
          retryDelayBase: APP_RETRY_DELAY_MS,
          returnFullDoc: false,
        }
      );
      results.push({
        ...article,
        db_operation_status: upsertResult.status,
        db_error_reason: upsertResult.status.startsWith('failed')
          ? 'DB operation error'
          : null,
      });
    } catch (error) {
      logger.error(
        `storeRelevantArticles: Failed to upsert article "${truncateString(
          article.headline,
          50
        )}" via library: ${error.message}`,
        { link: article.link }
      );
      results.push({
        ...article,
        db_operation_status: 'failed_db_error_after_retry',
        db_error_reason: error.message,
      });
    }
  }
  const successfullyStoredOrUpdatedCount = results.filter(
    (r) =>
      r.db_operation_status &&
      ['inserted', 'updated', 'no_change'].includes(r.db_operation_status)
  ).length;
  const failedToStoreCount = results.length - successfullyStoredOrUpdatedCount;
  logger.info('📊 Final Article Storage/Update Summary:');
  logger.info(`   - Articles attempted: ${articlesForFinalStore.length}`);
  logger.info(
    `   - Successfully processed (inserted/updated/no_change): ${successfullyStoredOrUpdatedCount}`
  );
  logger.info(
    `   - Failed or skipped (validation/DB error): ${failedToStoreCount}`
  );
  if (failedToStoreCount > 0) {
    logger.warn('\n⚠️ Articles with Final Storage/Update Issues:');
    results
      .filter(
        (r) =>
          !r.db_operation_status ||
          !['inserted', 'updated', 'no_change'].includes(r.db_operation_status)
      )
      .slice(0, 5)
      .forEach((item) => {
        logger.warn(
          `   - "${truncateString(
            item.headline || 'NO_HEADLINE',
            60
          )}" (Link: ${item.link?.substring(0, 30)}...): Status: ${
            item.db_operation_status
          }, Reason: ${item.db_error_reason || 'N/A'}`
        );
      });
  }
  return results;
}
