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
  try {
    logger.info('Starting headline processing workflow...');

    // Define the workflow steps
    const workflow = [
      {
        message: 'Fetching all headlines...',
        func: fetchAllHeadlines,
      },
      {
        message: 'Filtering fresh articles...',
        func: filterFreshArticles,
      },
      {
        message: 'Assessing headline relevance...',
        func: assessHeadlineRelevance,
      },
      {
        message: 'Enriching relevant articles with body content...',
        func: enrichWithArticleBody,
      },
      {
        message: 'Assessing array of articles...',
        func: assessArrayOfArticles,
      },
      {
        message: 'Sending wealth events email...',
        func: sendWealthEventsEmail,
      },
      {
        message: 'Storing relevant articles...',
        func: storeRelevantArticles,
      }
    ];

    let articles = [];
    for (const step of workflow) {
      logger.info(step.message);

      // Log the current state of articles before the function call
      logger.debug(`${articles.length} articles before step "${step.message}":`);
      console.log(articles)

      // Execute the function and pass in the current articles
      articles = await step.func(articles);

      // Log the current state of articles after the function call
      if (articles === undefined || articles === null) {
        logger.error(`Step "${step.message}" returned undefined or null. Stopping workflow.`);
        return;
      }

      if (!Array.isArray(articles)) {
        logger.error(`Step "${step.message}" did not return an array. Stopping workflow.`);
        return;
      }

      logger.info(`Step "${step.message}" completed. Articles count: ${articles.length}`);
      
      if (articles.length === 0) {
        logger.info('No articles to proceed with, exiting workflow...');
        return;
      }
    }
  } catch (error) {
    logger.error('Error during processing workflow', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available',
    });
  }
}
