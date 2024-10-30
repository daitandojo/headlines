// File: src/modules/assessments/assessHeadlines.js

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

  try {
    logger.info(`Assessing relevance for ${articleObjects.length} headlines.`);
    const processedArticles = await processInBatches(articleObjects, batchSize, assessBatchOfArticles);
    const relevantArticles = filterRelevantArticles(processedArticles);
    logAssessmentSummary(relevantArticles, processedArticles);
    return relevantArticles;
  } catch (error) {
    logger.error('Error during headline assessment', { error });
    return []; // Return empty array to maintain consistency
  }
}

async function assessBatchOfArticles(batch) {
  try {
    const arrayOfHeadlines = batch.map((article) => article.headline);
    const headlineAssessments = await retryWithLimit(() => assessBatchOfHeadlines(arrayOfHeadlines), 3, logger);

    if (!headlineAssessments) {
      logger.warn('No headline assessments returned after retries.');
      return []; // Return empty array if assessment fails
    }

    return attachAssessmentsToArticles(batch, headlineAssessments);
  } catch (error) {
    logger.error('Error processing batch of articles', { error });
    return []; // Return empty array in case of failure
  }
}

async function assessBatchOfHeadlines(headlines) {
  return await safeExecute(async () => {
    const messages = construct({
      instructionHeadlines,
      prompt: JSON.stringify(headlines),
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
    throw error;
  });
}

function attachAssessmentsToArticles(batch, assessments) {
  return batch.map((article, index) => {
    const assessment = assessments[index] || {};
    const updatedArticle = {
      ...article,
      relevance_headline: assessment.relevance_headline ?? 0,
      assessment_headline: assessment.assessment_headline ?? 'No assessment available',
    };

    if (updatedArticle.relevance_headline > RELEVANCE_THRESHOLD) {
      logger.info(`Forwarded for in-depth investigation: "${updatedArticle.headline}"`);
    }

    safeExecute(() => jsonStore({ object: updatedArticle, filePath: HEADLINES_PATH }), (error) =>
      logger.error(`Error storing headline: ${updatedArticle.headline}`, { error })
    );

    return updatedArticle;
  });
}

function filterRelevantArticles(articles) {
  return articles.filter((article) => article.relevance_headline > RELEVANCE_THRESHOLD);
}

function logAssessmentSummary(relevantArticles, processedArticles) {
  logger.info(`Headline Assessment Summary:`);
  logger.info(`Total Processed: ${processedArticles.length}, Relevant: ${relevantArticles.length}`);
  relevantArticles.forEach((article) => {
    logger.debug(`Relevant Article - Headline: "${article.headline}", Relevance: ${article.relevance_headline}`);
  });
}

