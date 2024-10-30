// File: src/workflows/startHeadlineProcessing.js

import { getLogger } from 'daitanjs/development';
import { fetchAllHeadlines } from '../modules/scraping/fetchHeadlines.js';
import { filterFreshArticles } from '../modules/jsonStore/filterFresh.js';
import { assessHeadlineRelevance } from '../modules/assessments/assessHeadlines.js';
import { enrichWithArticleBody } from '../modules/scraping/enrichWithBody.js';
import { assessArrayOfArticles } from '../modules/assessments/assessArticles.js';
import { storeRelevantArticles } from '../modules/jsonStore/storeArticles.js';
import { sendWealthEventsEmail } from '../modules/email/sendMail.js';

const logger = getLogger('workflow');

export async function startHeadlineProcessing() {
  logger.info('Starting headline processing workflow...');
  
  const context = { articles: [] };

  const workflowSteps = [
    { message: 'Fetching all headlines', func: fetchAllHeadlines, key: 'articles' },
    { message: 'Filtering fresh articles', func: filterFreshArticles, key: 'articles' },
    { message: 'Assessing headline relevance', func: assessHeadlineRelevance, key: 'articles' },
    { message: 'Enriching articles with body content', func: enrichWithArticleBody, key: 'articles' },
    { message: 'Assessing array of articles', func: assessArrayOfArticles, key: 'articles' },
    { message: 'Storing relevant articles', func: storeRelevantArticles, key: 'articles' },
    { message: 'Sending wealth events email', func: sendWealthEventsEmail, key: 'articles' },
  ];

  for (const step of workflowSteps) {
    try {
      logger.info(`Step: ${step.message}`);
      context[step.key] = await step.func(context[step.key]);
      if (context[step.key].length === 0) {
        logger.info(`No articles available after step "${step.message}". Exiting workflow.`);
        return;
      }
    } catch (error) {
      logger.error(`Error in step "${step.message}": ${error.message}`, { stack: error.stack });
      return;
    }
  }

  logFinalSummary(context.articles);

  logger.info('Headline processing workflow completed successfully.');
}

function logFinalSummary(articles) {
  if (!articles || articles.length === 0) {
    logger.info('No relevant articles to summarize.');
    return;
  }

  logger.info('Final Summary of Relevant Articles:');
  logger.info('----------------------------------');
  
  articles.forEach((article, index) => {
    const headlineRelevance = article.relevance_headline ?? 'N/A';
    const articleRelevance = article.relevance_article ?? 'N/A';
    const rationale = article.assessment_article ?? 'No rationale provided';

    logger.info(`Article #${index + 1}:`);
    console.log(article)
    logger.info(`- Headline: ${article.headline}`);
    logger.info(`- Headline Relevance: ${headlineRelevance}`);
    logger.info(`- Article Relevance: ${articleRelevance}`);
    logger.info(`- Rationale: ${rationale}`);
    logger.info('----------------------------------');
  });
};
