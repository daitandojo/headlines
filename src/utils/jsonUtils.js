// File: src/utils/jsonUtils.js

import { jsonStore, jsonQuery } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('json-utils');

// Store an article in the JSON store
export async function storeArticle(article, filePath) {
  try {
    jsonStore({ object: article, filePath });
    logger.info(`Article stored successfully: "${article.headline}"`);
  } catch (error) {
    logger.error(`Error storing article: "${article.headline}"`, { error });
  }
}

// Query JSON store to check if an article exists
export async function isArticleInStore(headline, filePath) {
  try {
    const results = jsonQuery({ query: { headline }, filePath });
    return results.length > 0;
  } catch (error) {
    logger.error(`Error querying JSON store for headline: "${headline}"`, { error });
    return false;
  }
}
