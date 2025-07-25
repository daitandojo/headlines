// File: headlines_mongo/src/modules/scraping/fetchHeadlines.js
import pLimit from 'p-limit';
import {
  SOURCES,
  CONCURRENCY_LIMIT,
  DEFAULT_USER_AGENT,
} from '../../config/index.js';
import { downloadAndExtract } from '@daitanjs/web';
import { getLogger } from '@daitanjs/development';
import { isValidURL, formatScrapedLinkData } from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-fetch');

export async function fetchAllHeadlines() {
  logger.info(
    `📰 Starting headline fetching process for ${SOURCES.length} sources...`
  );

  const effectiveConcurrency =
    typeof CONCURRENCY_LIMIT === 'number' && CONCURRENCY_LIMIT > 0
      ? CONCURRENCY_LIMIT
      : 5;

  logger.info(
    `   Concurrency: ${effectiveConcurrency}, User Agent: ${String(
      DEFAULT_USER_AGENT
    ).substring(0, 30)}...`
  );

  if (!Array.isArray(SOURCES) || SOURCES.length === 0) {
    logger.warn(
      'fetchAllHeadlines: No sources defined in SOURCES configuration. Aborting.'
    );
    return [];
  }

  const limit = pLimit(effectiveConcurrency);

  const headlinePromises = SOURCES.map((sourceConfig) =>
    limit(() => fetchHeadlinesFromSource(sourceConfig))
  );

  const results = await Promise.allSettled(headlinePromises);
  const allFetchedHeadlines = results
    .filter((res) => res.status === 'fulfilled' && Array.isArray(res.value))
    .flatMap((res) => res.value);

  logHeadlineFetchSummary(results);
  return allFetchedHeadlines;
}

async function fetchHeadlinesFromSource(sourceConfig) {
  const { name, baseUrl, startUrl, newspaper, ...parserOptions } = sourceConfig;

  if (!isValidURL(startUrl) || !isValidURL(baseUrl)) {
    logger.error(`[${name}] Invalid startUrl or baseUrl. Skipping source.`);
    return [];
  }

  logger.info(`🌐 [${name}] Fetching from: ${startUrl}`);

  try {
    const downloadOptions = {
      ...parserOptions,
      strategy: parserOptions.parserType === 'jsdom' ? 'robust' : 'fast',
      outputFormat: 'structured',
      extractLinks: true,
      userAgent: DEFAULT_USER_AGENT,
    };

    logger.debug(
      `[${name}] Calling @daitanjs/web::downloadAndExtract with options:`,
      downloadOptions
    );

    const extractedData = await downloadAndExtract(
      startUrl,
      downloadOptions,
      logger
    );

    logger.debug(`[${name}] Raw data returned from downloadAndExtract:`, {
      type: typeof extractedData,
      isArray: Array.isArray(extractedData),
      length: Array.isArray(extractedData) ? extractedData.length : undefined,
      preview: Array.isArray(extractedData)
        ? extractedData.slice(0, 2)
        : extractedData,
    });

    if (!Array.isArray(extractedData) || extractedData.length === 0) {
      logger.warn(`⚠️ [${name}] No raw items extracted from ${startUrl}.`);
      return [];
    }

    const formattedData = formatScrapedLinkData(
      extractedData,
      baseUrl,
      newspaper,
      {
        loggerInstance: logger,
        sourceNameForLog: name,
      }
    );

    logger.info(
      `[${name}] Formatted ${formattedData.length} valid headlines from ${extractedData.length} raw items.`
    );

    return formattedData;
  } catch (error) {
    logger.error(
      `❌ [${name}] Critical error fetching headlines from ${startUrl}: ${error.message}`,
      { error }
    );
    return [];
  }
}

function logHeadlineFetchSummary(results) {
  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  const failCount = results.length - successCount;
  const totalHeadlines = results
    .filter((r) => r.status === 'fulfilled' && Array.isArray(r.value))
    .reduce((sum, r) => sum + r.value.length, 0);

  logger.info('\n📊 Headline Fetching Summary:');
  logger.info(`   - Sources Attempted: ${results.length}`);
  logger.info(`   - Sources Processed Successfully: ${successCount}`);
  logger.info(`   - Sources Failed Critically: ${failCount}`);
  logger.info(`   - Total Valid & Formatted Headlines: ${totalHeadlines}`);
}
