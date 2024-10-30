// File: src/modules/scraping/fetchHeadlines.js

import pLimit from 'p-limit';
import { SOURCES } from '../../config/config.js';
import { downloadAndExtract } from 'daitanjs/web';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('headline-fetching');
const limit = pLimit(5); // Concurrency limit

export async function fetchAllHeadlines() {
  try {
    logger.info('Starting headline fetching process.');
    const headlineBatches = await Promise.all(SOURCES.map((source) =>
      limit(() => fetchHeadlinesFromSource(source))
    ));

    const flattenedHeadlines = headlineBatches.flat();
    logHeadlineFetchSummary(flattenedHeadlines, SOURCES.length);

    return flattenedHeadlines;
  } catch (error) {
    logger.error('Unhandled error in fetchAllHeadlines', {
      error: error.message,
      stack: error.stack || 'No stack available',
    });
    return [];
  }
}

async function fetchHeadlinesFromSource(source) {
  const { BASE_URL, BASE_DIRECTORY, LINK_CLASS, LINK_POSITION, NEWSPAPER, PARSER_TYPE } = source;
  const url = `${BASE_URL}${BASE_DIRECTORY}`;

  try {
    logger.info(`Fetching headlines from ${url} (Parser: ${PARSER_TYPE || 'jsdom'})`);

    const extractedData = await downloadAndExtract({
      url,
      options: {
        className: LINK_CLASS,
        parserType: PARSER_TYPE || 'jsdom',
        extractLinks: true,
      },
    });

    if (!Array.isArray(extractedData) || extractedData.length === 0) {
      logger.warn(`No headlines extracted from ${url}`);
      return [];
    }

    return formatExtractedData(extractedData, BASE_URL, NEWSPAPER, LINK_POSITION);
  } catch (error) {
    logger.error(`Error extracting headlines from ${url}: ${error.message}`, {
      stack: error.stack || 'No stack available',
    });
    return [];
  }
}

function formatExtractedData(extractedData, baseUrl, newspaper, linkPosition) {
  const formattedHeadlines = extractedData
    .map((data) => ({
      headline: data.text,
      link: linkPosition === 'relative' ? `${baseUrl}${data.link}` : data.link,
      newspaper,
    }))
    .filter((item) => item.headline && item.link);

  logger.info(`${formattedHeadlines.length} headlines extracted from ${baseUrl}`);
  return formattedHeadlines;
}

function logHeadlineFetchSummary(flattenedHeadlines, sourceCount) {
  logger.info('Headline Fetching Summary:');
  logger.info(`Total Headlines Found: ${flattenedHeadlines.length} from ${sourceCount} sources.`);
  flattenedHeadlines.forEach((headline) =>
    logger.debug(`Fetched Headline: "${headline.headline}" from ${headline.newspaper}`)
  );
}
