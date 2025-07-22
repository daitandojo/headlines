// File: headlines_mongo/src/modules/statistics/analyzeStats.js
import { readJSONsFromFile } from '@daitanjs/data';
import {
  HEADLINES_PATH,
  ARTICLES_PATH,
  HEADLINES_RELEVANCE_THRESHOLD,
  ARTICLES_RELEVANCE_THRESHOLD,
} from '../../config/index.js';
import { getLogger } from '@daitanjs/development';

const logger = getLogger('analyzeStats');

export function analyzeStats() {
  try {
    logger.info('Starting statistics analysis for headlines and articles.');

    const headlines = readJSONsFromFile({ filePath: HEADLINES_PATH });
    const articles = readJSONsFromFile({ filePath: ARTICLES_PATH });

    const headlineStats = analyzeHeadlineStats(headlines);
    const articleStats = analyzeArticleStats(articles);

    logStatsSummary(headlineStats, articleStats);
  } catch (error) {
    logger.error('Error analyzing statistics', { error });
    throw error;
  }
}

function analyzeHeadlineStats(headlines) {
  logger.info(`Analyzing ${headlines.length} headlines for relevance.`);
  const stats = {};

  headlines.forEach((headline) => {
    const source = headline.source || 'Unknown';
    if (!stats[source]) {
      stats[source] = {
        total: 0,
        relevantByHeadline: 0,
      };
    }
    stats[source].total += 1;
    if (headline.relevance_headline > HEADLINES_RELEVANCE_THRESHOLD) {
      stats[source].relevantByHeadline += 1;
    }
  });

  return stats;
}

function analyzeArticleStats(articles) {
  logger.info(`Analyzing ${articles.length} articles for relevance.`);
  const stats = {};

  articles.forEach((article) => {
    const source = article.source || 'Unknown';
    if (!stats[source]) {
      stats[source] = {
        total: 0,
        relevantByArticle: 0,
      };
    }
    stats[source].total += 1;
    if (article.relevance_article > ARTICLES_RELEVANCE_THRESHOLD) {
      stats[source].relevantByArticle += 1;
    }
  });

  return stats;
}

function logStatsSummary(headlineStats, articleStats) {
  logger.info('Statistics Analysis Summary:');

  logger.info('\nHeadline Analysis Stats:');
  Object.keys(headlineStats).forEach((source) => {
    const stats = headlineStats[source];
    logger.info(
      `${source}: Total Headlines: ${stats.total}, Relevant by Headline: ${stats.relevantByHeadline}`
    );
  });

  logger.info('\nArticle Analysis Stats:');
  Object.keys(articleStats).forEach((source) => {
    const stats = articleStats[source];
    logger.info(
      `${source}: Total Articles: ${stats.total}, Relevant by Article: ${stats.relevantByArticle}`
    );
  });
}
