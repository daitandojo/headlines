// File: src/modules/jsonStore/storeArticles.js

import { jsonStore } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';
import pLimit from 'p-limit';

const logger = getLogger('jsonStore');
const limit = pLimit(5); // Limit concurrency for storage operations
import path from 'path';
import { ARTICLES_PATH } from '../../config/config.js';

export async function storeRelevantArticles(articleObjects) {
  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return []; // Return empty array for consistency
  }

  logger.info(`Storing ${articleObjects.length} relevant articles.`);

  try {
    const storedArticles = await Promise.all(articleObjects.map((article, index) =>
      limit(() => storeSingleArticle(article, index))
    ));

    const successfulStores = filterStoredArticles(storedArticles);
    logStorageSummary(successfulStores, articleObjects.length);

    return successfulStores; // Return successfully stored articles
  } catch (error) {
    logger.error('Unhandled error in storeRelevantArticles', { error });
    return []; // Ensure an empty array is returned in case of failure
  }
}

async function storeSingleArticle(articleObject, index) {
  try {
    logger.info(`Storing article #${index + 1}: "${articleObject.headline || 'No headline provided'}"`);
    await jsonStore({ object: articleObject, filePath: path.resolve(ARTICLES_PATH) });
    logger.debug(`Successfully stored article: "${articleObject.headline}"`);
    return { ...articleObject, stored: true };
  } catch (error) {
    logger.error(`Error storing article: "${articleObject.headline || 'No headline provided'}"`, { error });
    return { ...articleObject, stored: false, error: error.message };
  }
}

function filterStoredArticles(articles) {
  return articles.filter((article) => article.stored);
}

function logStorageSummary(storedArticles, totalArticles) {
  logger.info('Storage Summary:');
  logger.info(`Total Articles: ${totalArticles}, Successfully Stored: ${storedArticles.length}`);
  storedArticles.forEach((article) =>
    logger.debug(`Stored Article - Headline: "${article.headline}"`)
  );
}
