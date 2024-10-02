import { RELEVANCE_THRESHOLD, HEADLINES_PATH } from '../../config/config.js';
import { jsonStore } from 'daitanjs/jsonstore';
import { getLogger } from 'daitanjs/development';
import { construct, generateIntelligence } from 'daitanjs/intelligence';
import { instructionHeadlines } from './instructionHeadlines.js';
import { shotsInput, shotsOutput } from './shotsHeadlines.js';
import { safeExecute } from 'daitanjs/error';
import { retryWithLimit, processInBatches } from 'daitanjs/utils';

const logger = getLogger('headline-assessment');

export async function assessHeadlineRelevance(articleObjects) {
  const batchSize = 10;

  // Helper function to process a batch of articles
  const processBatch = async (batch) => {
    try {
      const arrayOfHeadlines = batch.map((h) => h.headline);

      // Assessing relevance of the batch of headlines
      const headlineAssessments = await retryWithLimit(
        () => assessBatchOfHeadlines(arrayOfHeadlines),
        3,
        logger
      );

      if (!headlineAssessments) {
        logger.warn('No headline assessments returned after retries.');
        return []; // Returning an empty array if the assessments fail
      }

      // Attaching assessment results to each article object in the batch
      const updatedBatch = batch.map((articleObject, index) => {
        const assessment = headlineAssessments[index] || {};

        Object.assign(articleObject, {
          relevance_headline: assessment.relevance_headline ?? 0, // Default to 0 if assessment is missing
          assessment_headline: assessment.assessment_headline ?? 'No assessment available',
        });

        if (articleObject.relevance_headline > RELEVANCE_THRESHOLD) {
          logger.info(`Forwarded for in-depth investigation: ${articleObject.headline}`);
        }

        // Storing the headline safely
        safeExecute(
          () => jsonStore({ object: articleObject, filePath: HEADLINES_PATH }),
          (error) => logger.error(`Error storing headline: ${articleObject.headline}`, { error })
        );

        return articleObject;
      });

      return updatedBatch;
    } catch (error) {
      logger.error('Error processing batch of articles', { error });
      return []; // Returning an empty array if batch processing fails
    }
  };

  try {
    // Process all articles in batches
    const processedArticles = await processInBatches(articleObjects, batchSize, processBatch);

    // Filter articles based on relevance threshold
    const relevantArticles = processedArticles.filter(
      (article) => article.relevance_headline > RELEVANCE_THRESHOLD
    );

    logger.info(`${relevantArticles.length} articles passed the relevance threshold.`);
    return relevantArticles;
  } catch (error) {
    logger.error('Error during batch processing of articles', { error });
    return []; // Ensure an empty array is returned in case of failure
  }
}

// Assess a batch of headlines by generating intelligence
async function assessBatchOfHeadlines(arrayOfHeadlines) {
  return await safeExecute(async () => {
    const messages = construct({
      instructionHeadlines,
      prompt: JSON.stringify(arrayOfHeadlines),
      shotsInput,
      shotsOutput,
    });

    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
    });

    if (!response || !response.assessment) {
      throw new Error('Invalid response from generateIntelligence');
    }

    return response.assessment;
  }, (error) => {
    logger.error('Error analyzing headline batch', { error });
    throw error; // Re-throw to trigger retry logic
  });
}

export { assessBatchOfHeadlines };
