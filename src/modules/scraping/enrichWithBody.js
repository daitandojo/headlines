import { SOURCES } from '../../config/config.js';
import { getLogger } from 'daitanjs/development';
import { downloadAndExtract } from 'daitanjs/web'; // Updated to use downloadAndExtract
import pLimit from 'p-limit';

const logger = getLogger('enrichWithBody');
const limit = pLimit(5);

const MIN_CONTENT_LENGTH = 100;

class ShortArticleError extends Error {
  constructor(message, articleObject, contentLength) {
    super(message);
    this.name = 'ShortArticleError';
    this.articleObject = articleObject;
    this.contentLength = contentLength;
  }
}

export async function enrichWithArticleBody(articleObjects) {
  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return []; // Return an empty array to maintain consistency
  }

  logger.info(`Received ${articleObjects.length} articles for enrichment.`);

  try {
    const results = await Promise.all(
      articleObjects.map((articleObject, i) =>
        limit(async () => {
          if (!articleObject || typeof articleObject !== 'object') {
            logger.error(`Invalid article object at index ${i}`, { articleObject });
            return { ...articleObject, articleContent: {}, error: 'Invalid article object' };
          }

          logger.info(`Processing article #${i + 1}: "${articleObject.headline || 'No headline provided'}"`);

          try {
            const source = SOURCES.find((src) => src.NEWSPAPER === articleObject.newspaper);

            if (!source) {
              logger.warn(`Source configuration not found for newspaper: ${articleObject.newspaper}`, { articleObject });
              return { ...articleObject, articleContent: {}, error: 'Source configuration not found' };
            }

            if (!articleObject.link) {
              logger.error(`Article link is missing for headline: "${articleObject.headline || 'No headline provided'}"`, { articleObject });
              return { ...articleObject, articleContent: {}, error: 'Missing link' };
            }

            const { ARTICLE_STRUCTURE, PARSER_TYPE } = source;

            // Utilize the downloadAndExtract function
            const res = await downloadAndExtract({
              url: articleObject.link,
              options: {
                articleStructure: ARTICLE_STRUCTURE,
                parserType: PARSER_TYPE || 'jsdom',
              },
            });

            if (!res || Object.keys(res).length === 0) {
              throw new Error('No content extracted from the article');
            }

            const totalContentLength = Object.values(res)
              .flat()
              .join(' ')
              .length;

            if (totalContentLength < MIN_CONTENT_LENGTH) {
              throw new ShortArticleError(
                `Content length (${totalContentLength} characters) below minimum threshold.`,
                articleObject,
                totalContentLength
              );
            }

            return { ...articleObject, articleContent: res };
          } catch (error) {
            if (error instanceof ShortArticleError) {
              logger.warn(`Article too short: ${error.message}`, {
                articleObject: error.articleObject,
                contentLength: error.contentLength,
              });
            } else {
              logger.error(
                `Error during article download for: "${articleObject.headline || 'No headline provided'}"`,
                { error: error.message, articleObject }
              );
            }
            return { ...articleObject, articleContent: {}, error: error.message };
          }
        })
      )
    );

    const enrichedArticles = results.filter((article) => !article.error);
    const failedArticles = results.filter((article) => article.error);

    logger.info(`Enrichment completed for ${enrichedArticles.length} articles.`);
    if (failedArticles.length > 0) {
      logger.warn(`${failedArticles.length} articles could not be enriched.`);
    }

    return results; // Return all articles (both enriched and failed) to keep the workflow intact
  } catch (error) {
    logger.error('Unhandled error in enrichWithArticleBody', { error: error.message });
    return []; // Ensure an empty array is returned in case of failure
  }
}
