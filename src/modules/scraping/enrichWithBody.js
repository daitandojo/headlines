// File: src/modules/scraping/enrichWithBody.js

import { SOURCES } from '../../config/config.js';
import { getLogger } from 'daitanjs/development';
import { downloadAndExtract } from 'daitanjs/web';
import pLimit from 'p-limit';

const logger = getLogger('enrichWithBody');
const limit = pLimit(5); // Limit concurrency to 5 at a time
const MIN_CONTENT_LENGTH = 100;

export async function enrichWithArticleBody(articleObjects) {
  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return []; // Return an empty array to maintain consistency
  }

  logger.info(`Starting enrichment for ${articleObjects.length} articles.`);

  try {
    const results = await Promise.all(articleObjects.map((article, i) =>
      limit(() => processArticleForEnrichment(article, i))
    ));

    const enrichedArticles = filterValidArticles(results);
    logEnrichmentSummary(enrichedArticles, results);

    return enrichedArticles; // Return enriched articles
  } catch (error) {
    logger.error('Unhandled error in enrichWithArticleBody', { error });
    return []; // Ensure an empty array is returned in case of failure
  }
}

async function processArticleForEnrichment(articleObject, index) {
  if (!articleObject || typeof articleObject !== 'object') {
    logger.error(`Invalid article object at index ${index}`, { articleObject });
    return createInvalidArticleResponse(articleObject, 'Invalid article object');
  }

  logger.info(`Processing article #${index + 1}: "${articleObject.headline || 'No headline provided'}"`);

  try {
    const source = getSourceConfiguration(articleObject.newspaper);
    if (!source) {
      return createInvalidArticleResponse(articleObject, 'Source configuration not found');
    }

    return await enrichArticleContent(articleObject, source);
  } catch (error) {
    logger.error(`Error processing article for enrichment: "${articleObject.headline || 'No headline provided'}"`, {
      error: error.message,
    });
    return createInvalidArticleResponse(articleObject, error.message);
  }
}

function getSourceConfiguration(newspaper) {
  const source = SOURCES.find((src) => src.NEWSPAPER === newspaper);
  if (!source) {
    logger.warn(`Source configuration not found for newspaper: ${newspaper}`);
  }
  return source;
}

async function enrichArticleContent(articleObject, source) {
  if (!articleObject.link) {
    logger.error(`Missing link for headline: "${articleObject.headline || 'No headline provided'}"`);
    return createInvalidArticleResponse(articleObject, 'Missing link');
  }

  const { ARTICLE_STRUCTURE, PARSER_TYPE } = source;

  try {
    const extractionResult = await downloadAndExtract({
      url: articleObject.link,
      options: {
        articleStructure: ARTICLE_STRUCTURE,
        parserType: PARSER_TYPE || 'jsdom',
      },
    });

    if (!extractionResult || Object.keys(extractionResult).length === 0) {
      throw new Error('No content extracted from the article');
    }

    if (isContentTooShort(extractionResult)) {
      throw new ShortArticleError('Content length below minimum threshold', articleObject);
    }

    return { ...articleObject, articleContent: extractionResult };
  } catch (error) {
    handleEnrichmentError(error, articleObject);
    return createInvalidArticleResponse(articleObject, error.message);
  }
}

function isContentTooShort(content) {
  const totalContentLength = Object.values(content).flat().join(' ').length;
  return totalContentLength < MIN_CONTENT_LENGTH;
}

function handleEnrichmentError(error, articleObject) {
  if (error instanceof ShortArticleError) {
    logger.warn(`Article too short: ${error.message}`, {
      articleObject: error.articleObject,
    });
  } else {
    logger.error(`Error during article download for: "${articleObject.headline || 'No headline provided'}"`, {
      error: error.message,
    });
  }
}

function createInvalidArticleResponse(articleObject, errorMessage) {
  return {
    ...articleObject,
    articleContent: {},
    error: errorMessage,
  };
}

function filterValidArticles(articles) {
  return articles.filter((article) => !article.error);
}

function logEnrichmentSummary(enrichedArticles, allArticles) {
  logger.info('Enrichment Summary:');
  logger.info(`Total Articles Processed: ${allArticles.length}, Successfully Enriched: ${enrichedArticles.length}`);
  enrichedArticles.forEach((article) =>
    logger.debug(`Enriched Article - Headline: "${article.headline}", Length: ${Object.values(article.articleContent).flat().join(' ').length}`)
  );
}

// Custom Error Class for Short Articles
class ShortArticleError extends Error {
  constructor(message, articleObject) {
    super(message);
    this.name = 'ShortArticleError';
    this.articleObject = articleObject;
  }
}
