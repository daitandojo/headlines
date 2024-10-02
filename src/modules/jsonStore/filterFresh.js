import { HEADLINES_PATH } from '../../config/config.js';
import { jsonQuery } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('jsonStore');

export async function filterFreshArticles(articleObjects) {
  try {
    // Make sure `jsonQuery` is awaited properly for async operations
    const freshArticles = await Promise.all(
      articleObjects.map(async (articleObject) => {
        try {
          const isInJsonStore = await jsonQuery({
            query: { headline: articleObject.headline },
            filePath: HEADLINES_PATH,
          });
          return isInJsonStore.length > 0 ? null : articleObject;
        } catch (queryError) {
          logger.error(`Error querying JSON store for headline: ${articleObject.headline}`, {
            error: queryError,
          });
          return null; // Returning null here will effectively ignore this article in the final output
        }
      })
    );

    // Filter out nulls or undefined values
    const result = freshArticles.filter(Boolean);
    logger.info(`${result.length} new articles established as 'new'.`);
    
    // Always return an array, even if empty
    return result;
  } catch (error) {
    logger.error('Error filtering fresh articles', { error });
    throw error;
  }
}
