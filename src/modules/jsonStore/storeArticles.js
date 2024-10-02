// File: src/modules/jsonStore/storeArticles.js
import { ARTICLES_PATH } from '../../config/config.js';
import { jsonStore } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('jsonStore');

export async function storeRelevantArticles(articleObjects) {
  try {
    await Promise.all(
      articleObjects.map(async (articleObject) => {
        try {
          jsonStore({
            object: articleObject,
            filePath: ARTICLES_PATH,
          });
        } catch (error) {
          logger.error(`Error storing article: ${articleObject.headline}`, {
            error,
          });
        }
      })
    );
    logger.info(`Stored ${articleObjects.length} relevant articles.`);
    return articleObjects;
  } catch (error) {
    logger.error('Error storing relevant articles', { error });
    return articleObjects;
  }
}
