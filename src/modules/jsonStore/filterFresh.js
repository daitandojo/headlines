// File: src/modules/jsonStore/filterFresh.js

import { HEADLINES_PATH } from '../../config/config.js';
import { jsonQuery } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';
import pLimit from 'p-limit';

import { isArticleInStore } from '../../utils/jsonUtils.js';

const logger = getLogger('jsonStore');
const limit = pLimit(5);

export async function filterFreshArticles(articleObjects) {
  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return [];
  }

  logger.info(`Filtering fresh articles from a list of ${articleObjects.length} articles.`);

  try {
    const freshArticles = await Promise.all(articleObjects.map((article, index) =>
      limit(() => checkIfArticleIsFresh(article, index))
    ));

    const validFreshArticles = filterOutNulls(freshArticles);
    logFreshArticlesSummary(validFreshArticles, articleObjects.length);

    return validFreshArticles;
  } catch (error) {
    logger.error('Unhandled error in filterFreshArticles', { error });
    return [];
  }
}

async function checkIfArticleIsFresh(articleObject) {
  const isInStore = await isArticleInStore(articleObject.headline, HEADLINES_PATH);
  if (isInStore) {
    logger.info(`Article "${articleObject.headline}" is already in store.`);
    return null;
  }
  return articleObject;
};

function filterOutNulls(articles) {
  return articles.filter(Boolean);
}

function logFreshArticlesSummary(freshArticles, totalArticles) {
  logger.info('Fresh Articles Filtering Summary:');
  logger.info(`Total Articles: ${totalArticles}, Fresh Articles: ${freshArticles.length}`);
  freshArticles.forEach((article) =>
    logger.debug(`Fresh Article - Headline: "${article.headline}"`)
  );
}
