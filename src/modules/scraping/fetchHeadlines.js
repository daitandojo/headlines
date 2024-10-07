import pLimit from 'p-limit';
import { SOURCES } from '../../config/config.js';
import { downloadAndExtract } from 'daitanjs/web';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('headline-fetching');
const limit = pLimit(5); // Concurrency limit

export async function fetchAllHeadlines() {
  try {
    const allHeadlines = await Promise.all(
      SOURCES.map((source) =>
        limit(async () => {
          try {
            const { BASE_URL, BASE_DIRECTORY, LINK_CLASS, LINK_POSITION, NEWSPAPER, PARSER_TYPE } = source;
            const url = `${BASE_URL}${BASE_DIRECTORY}`;
            logger.info(`Fetching headlines from ${url} (through ${PARSER_TYPE || 'jsdom'}/${LINK_CLASS}...`);
       
            // Utilize the downloadAndExtract function
            const extractedData = await downloadAndExtract({
              url,
              options: {
                className: LINK_CLASS,
                parserType: PARSER_TYPE || 'jsdom',
                extractLinks: true,
              },
            });

            if (!Array.isArray(extractedData) || extractedData.length === 0) {
              logger.warn(`No data extracted from ${url} using parser type ${PARSER_TYPE}`);
              return [];
            }

            const filteredLinks = extractedData
              .map((t) => ({
                headline: t.text,
                link: LINK_POSITION === 'relative' ? `${BASE_URL}${t.link}` : t.link,
                newspaper: NEWSPAPER,
              }))
              .filter((item) => item.headline && item.link); // Ensure valid data

            logger.info(`${filteredLinks.length} links extracted from ${BASE_URL}`);
            return filteredLinks;
          } catch (error) {
            // Improved error handling to ensure all errors are logged properly
            logger.error(`Error extracting headlines from ${source.BASE_URL}: ${error.message}`, {
              stack: error.stack || 'No stack available',
            });
            return [];
          }
        })
      )
    );

    const flattenedHeadlines = allHeadlines.flat();
    logger.info(`TOTAL OF ${flattenedHeadlines.length} headlines found across ${SOURCES.length} newspapers.`);
    logger.info(`====================================================`)
    return flattenedHeadlines;
  } catch (error) {
    // Properly log any unexpected error during the headline fetching process
    logger.error('Error fetching headlines', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available',
    });
    return [];
  }
}

// SSL/TLS Handling (Optional but recommended for avoiding SSL/TLS issues)
// This line is only for development and not recommended for production use as it ignores SSL issues.
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
