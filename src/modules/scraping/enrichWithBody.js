// File: headlines_mongo/src/modules/scraping/enrichWithBody.js
import {
  SOURCES,
  DEFAULT_USER_AGENT,
  MIN_ARTICLE_CHARS,
  CONCURRENCY_LIMIT,
} from '../../config/index.js';
import { getLogger } from '@daitanjs/development';
import { downloadAndExtract } from '@daitanjs/web';
import pLimit from 'p-limit';
import {
  isValidURL,
  truncateString,
  retryWithBackoff,
} from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-enrich');
const MAX_ENRICH_RETRIES = 2;

function getTotalExtractedText(articleContent = {}) {
  if (typeof articleContent !== 'object' || articleContent === null) {
    return '';
  }
  return Object.values(articleContent)
    .reduce((acc, val) => acc.concat(Array.isArray(val) ? val : []), [])
    .filter((text) => typeof text === 'string' && text.trim() !== '')
    .join(' \n\n ');
}

export async function enrichWithArticleBody(articleObjects) {
  if (!Array.isArray(articleObjects) || articleObjects.length === 0) {
    logger.warn(
      'enrichWithArticleBody: No articles provided for enrichment. Returning empty array.'
    );
    return [];
  }

  const effectiveConcurrency =
    typeof CONCURRENCY_LIMIT === 'number' && CONCURRENCY_LIMIT > 0
      ? CONCURRENCY_LIMIT
      : 3;

  logger.info(
    `📰 Starting content enrichment for ${articleObjects.length} articles using concurrency: ${effectiveConcurrency}.`
  );

  const limit = pLimit(effectiveConcurrency);

  const enrichmentPromises = articleObjects.map((article, index) =>
    limit(async () => {
      try {
        return await processSingleArticle(
          article,
          index,
          articleObjects.length
        );
      } catch (processingError) {
        logger.error(
          `enrichWithArticleBody: Uncaught error from processSingleArticle for "${truncateString(
            article?.headline,
            50
          )}" (URL: ${article?.link || 'N/A'}): ${processingError.message}`,
          { stack: processingError.stack?.substring(0, 500) }
        );
        return {
          ...(article || {}),
          articleContent: {},
          enrichment_error: `Unhandled processing error: ${processingError.message}`,
          error:
            (article || {}).error ||
            `Unhandled processing error: ${processingError.message}`,
        };
      }
    })
  );

  const results = await Promise.allSettled(enrichmentPromises);
  const finalArticles = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      const originalArticle = articleObjects[index] || {};
      const reason = result.reason?.message || String(result.reason);
      logger.error(
        `enrichWithArticleBody: Promise rejected for article "${truncateString(
          originalArticle.headline,
          50
        )}" (URL: ${originalArticle.link || 'N/A'}): ${reason}`,
        { rejectionReason: result.reason }
      );
      return {
        ...originalArticle,
        articleContent: {},
        enrichment_error: `Enrichment promise rejected: ${reason}`,
        error:
          originalArticle.error || `Enrichment promise rejected: ${reason}`,
      };
    }
  });

  logEnrichmentSummary(finalArticles, articleObjects.length);
  return finalArticles;
}

async function processSingleArticle(article, index, totalArticles) {
  const progress = `[${index + 1}/${totalArticles}]`;

  if (
    !article ||
    typeof article !== 'object' ||
    !article.link ||
    !article.newspaper
  ) {
    const articlePreview = article
      ? `Headline: ${truncateString(
          String(article.headline ?? 'N/A'),
          30
        )}, Link: ${String(article.link ?? 'N/A')}, Newspaper: ${String(
          article.newspaper ?? 'N/A'
        )}`
      : 'Invalid/Null Article Object';
    logger.warn(
      `processSingleArticle: ${progress} Invalid article or missing link/newspaper. Info: ${articlePreview}`,
      { articleData: article }
    );
    return {
      ...(article || {}),
      articleContent: {},
      enrichment_error: 'Invalid article data for enrichment.',
      error: (article || {}).error || 'Invalid article data for enrichment.',
    };
  }

  const articleDisplayInfo = `"${truncateString(article.headline, 50)}" (URL: ${
    article.link
  }, Source: ${article.newspaper})`;

  if (!isValidURL(article.link)) {
    logger.warn(
      `processSingleArticle: ${progress} Invalid URL for ${articleDisplayInfo}. Skipping enrichment.`
    );
    return {
      ...article,
      articleContent: {},
      enrichment_error: 'Invalid URL format.',
      error: article.error || 'Invalid URL format.',
    };
  }

  const sourceConfig = SOURCES.find((s) => s.newspaper === article.newspaper);
  if (!sourceConfig) {
    logger.warn(
      `processSingleArticle: ${progress} No source configuration for "${article.newspaper}". Skipping ${articleDisplayInfo}.`
    );
    return {
      ...article,
      articleContent: {},
      enrichment_error: `No config for ${article.newspaper}`,
      error: article.error || `No config for ${article.newspaper}`,
    };
  }

  if (
    !sourceConfig.articleStructure ||
    !Array.isArray(sourceConfig.articleStructure) ||
    sourceConfig.articleStructure.length === 0
  ) {
    logger.warn(
      `processSingleArticle: ${progress} No articleStructure for "${article.newspaper}". Cannot enrich ${articleDisplayInfo}.`
    );
    return {
      ...article,
      articleContent: {},
      enrichment_error: `No articleStructure for ${article.newspaper}`,
      error: article.error || `No articleStructure for ${article.newspaper}`,
    };
  }

  const parserForEnrichment =
    sourceConfig.enrichmentParserType || sourceConfig.parserType || 'robust';
  logger.info(
    `🔄 ${progress} Enriching: ${articleDisplayInfo} (Strategy: ${parserForEnrichment})`
  );

  try {
    const extractedContent = await retryWithBackoff(
      () =>
        downloadAndExtract(
          article.link,
          {
            strategy: parserForEnrichment,
            outputFormat: 'structured',
            articleStructure: sourceConfig.articleStructure,
            userAgent: DEFAULT_USER_AGENT,
          },
          logger
        ),
      MAX_ENRICH_RETRIES,
      {
        loggerInstance: logger,
        operationName: `Enrich ${truncateString(article.link, 40)}`,
      }
    );

    let hasMeaningfulContent = false;
    if (
      extractedContent &&
      typeof extractedContent === 'object' &&
      Object.keys(extractedContent).length > 0
    ) {
      hasMeaningfulContent = Object.values(extractedContent).some(
        (value) =>
          Array.isArray(value) &&
          value.some(
            (text) => typeof text === 'string' && text.trim().length > 0
          )
      );
    }

    if (!hasMeaningfulContent) {
      logger.warn(
        `⚠️ ${progress} No meaningful content extracted by scraper for ${articleDisplayInfo}.`
      );
      return {
        ...article,
        articleContent: extractedContent || {},
        enrichment_error: 'No meaningful content extracted.',
        error: article.error || 'No meaningful content extracted.',
      };
    }

    const totalContentLength = getTotalExtractedText(extractedContent);

    if (totalContentLength < MIN_ARTICLE_CHARS) {
      logger.warn(
        `⚠️ ${progress} Content for ${articleDisplayInfo} too short (${totalContentLength} chars, threshold: ${MIN_ARTICLE_CHARS}). Flagging.`
      );
      return {
        ...article,
        articleContent: extractedContent,
        enrichment_error: `Content too short (<${MIN_ARTICLE_CHARS} chars). Length: ${totalContentLength}`,
        error: article.error || 'Insufficient content',
      };
    }

    logger.info(
      `✅ ${progress} Successfully enriched: ${articleDisplayInfo} (Length: ${totalContentLength} chars)`
    );
    return {
      ...article,
      articleContent: extractedContent,
      enrichment_error: null,
      error:
        article.error === 'Insufficient content' ||
        (article.error &&
          (article.error.includes('Enrichment failed') ||
            article.error.includes('No meaningful content extracted')))
          ? null
          : article.error,
    };
  } catch (error) {
    logger.error(
      `❌ ${progress} Error enriching ${articleDisplayInfo} after retries: ${error.message}`,
      { stack: error.stack?.substring(0, 300) }
    );
    return {
      ...article,
      articleContent: {},
      enrichment_error: `Enrichment failed after retries: ${error.message}`,
      error: article.error || `Enrichment failed: ${error.message}`,
    };
  }
}

function logEnrichmentSummary(allProcessedArticles, totalAttempted) {
  const successfullyEnrichedSufficientContent = allProcessedArticles.filter(
    (article) =>
      article &&
      !article.enrichment_error &&
      article.articleContent &&
      Object.keys(article.articleContent).length > 0 &&
      getTotalExtractedText(article.articleContent).length >= MIN_ARTICLE_CHARS
  ).length;

  const failedEnrichmentErrors = allProcessedArticles.filter(
    (article) =>
      article &&
      article.enrichment_error &&
      !article.enrichment_error.startsWith('Content too short')
  ).length;

  const failedTooShort = allProcessedArticles.filter(
    (article) =>
      article &&
      article.enrichment_error &&
      article.enrichment_error.startsWith('Content too short')
  ).length;

  const noMeaningfulContentExtracted = allProcessedArticles.filter(
    (article) =>
      article &&
      article.enrichment_error &&
      (article.enrichment_error === 'No meaningful content extracted.' ||
        article.enrichment_error === 'Scraper returned empty or invalid data.')
  ).length;

  logger.info('\n📊 Content Enrichment Summary:');
  logger.info(`   - Articles submitted for enrichment: ${totalAttempted}`);
  logger.info(
    `   - Successfully enriched with sufficient content (>=${MIN_ARTICLE_CHARS} chars): ${successfullyEnrichedSufficientContent}`
  );
  logger.info(`   - Failed due to content being too short: ${failedTooShort}`);
  logger.info(
    `   - Failed due to scraper extracting no meaningful content: ${noMeaningfulContentExtracted}`
  );
  logger.info(
    `   - Failed due to other enrichment errors (network/parsing): ${
      failedEnrichmentErrors - noMeaningfulContentExtracted
    }`
  );
}
