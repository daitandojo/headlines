// File: src/modules/statistics/analyzeStats.js
import { readJSONsFromFile } from 'daitanjs/jsonstore';
import {
  HEADLINES_PATH,
  ARTICLES_PATH,
  RELEVANCE_THRESHOLD,
} from '../../config/config.js';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('analyzeStats');

export function analyzeStats() {
  try {
    const headlines = readJSONsFromFile({ filePath: HEADLINES_PATH });
    const articles = readJSONsFromFile({ filePath: ARTICLES_PATH });

    const headlineStats = {};
    const articleStats = {};

    headlines.forEach((headline) => {
      const source = headline.source;
      if (!headlineStats[source]) {
        headlineStats[source] = {
          total: 0,
          relevantByHeadline: 0,
        };
      }
      headlineStats[source].total += 1;
      if (headline.relevance_headline > RELEVANCE_THRESHOLD) {
        headlineStats[source].relevantByHeadline += 1;
      }
    });

    articles.forEach((article) => {
      const source = article.source;
      if (!articleStats[source]) {
        articleStats[source] = {
          total: 0,
          relevantByArticle: 0,
        };
      }
      articleStats[source].total += 1;
      if (article.relevance_article > RELEVANCE_THRESHOLD) {
        articleStats[source].relevantByArticle += 1;
      }
    });

    logger.info('Headline Analysis Stats:');
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
  } catch (error) {
    logger.error('Error analyzing statistics', { error });
    throw error;
  }
}
