// File: src/modules/assessments/assessArticles.js

import { construct, generateIntelligence } from 'daitanjs/intelligence';
import { getLogger } from 'daitanjs/development';
import { instructionArticle } from './instructionArticle.js';
import { shotsInput, shotsOutput } from './shotsArticle.js';
import pLimit from 'p-limit';
import { RELEVANCE_THRESHOLD } from '../../config/config.js';
import { safeExecute } from 'daitanjs/error';

const logger = getLogger('article-assessment');
const limit = pLimit(5); // Limit concurrency to prevent overloading the system

export async function assessArrayOfArticles(articleObjects) {
  logger.info(`Received ${articleObjects.length} articles for assessment.`);

  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return []; // Return an empty array for invalid input
  }

  try {
    const assessedArticles = await Promise.all(articleObjects.map((articleObject) =>
      limit(() => assessArticle(articleObject))
    ));

    const relevantArticles = filterRelevantArticles(assessedArticles);
    logAssessmentSummary(relevantArticles, assessedArticles);
    
    return relevantArticles;
  } catch (error) {
    logger.error('Unhandled error in assessArrayOfArticles', { error });
    return []; // Return an empty array in case of failure
  }
}

async function assessArticle(articleObject) {
  const fullArticleContent = extractFullArticleContent(articleObject.articleContent);

  if (isContentTooShort(fullArticleContent)) {
    logger.warn('Article content is too short to analyze:', { fullArticleContent });
    return createShortArticleAssessment(articleObject);
  }

  logger.info('Prompting OpenAI with article content for assessment...');
  const analysisResult = await analyzeArticleBody(fullArticleContent);

  return mergeArticleAssessment(articleObject, analysisResult);
}

function extractFullArticleContent({ headlines = [], subheadings = [], captions = [], contents = [] }) {
  return [headlines.join('. '), subheadings.join('. '), captions.join('. '), contents.join('. ')]
    .filter(Boolean)
    .join('. ');
}

function isContentTooShort(content) {
  return content.length < 10;
}

function createShortArticleAssessment(articleObject) {
  return {
    ...articleObject,
    relevance_article: 0,
    assessment_article: 'ARTICLE TOO SHORT TO ANALYZE',
  };
}

async function analyzeArticleBody(articleContent) {
  return await safeExecute(async () => {
    const messages = construct({
      instructionArticle,
      shotsInput,
      shotsOutput,
      prompt: articleContent,
    });

    console.log(messages);

    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      summary: 'Article body - wealth analysis',
      messages,
      max_tokens: 1500,
    });

    if (!response) {
      throw new Error('No response from OpenAI service.');
    }

    console.log(response)

    return { ...response, result: 'success' };
  }, (error) => logger.error('Error occurred during article body analysis', { error }));
}

function mergeArticleAssessment(articleObject, analysisResult) {
  if (!analysisResult || typeof analysisResult !== 'object' || Array.isArray(analysisResult)) {
    logger.error('Invalid or missing response from analyzeArticleBody.', { analysisResult });
    return {
      ...articleObject,
      relevance_article: 0,
      assessment_article: 'INVALID OR MISSING ANALYSIS RESULT',
    };
  }

  return {
    ...articleObject,
    topic: analysisResult.topic || 'Unknown',
    relevance_article: analysisResult.relevance_article || 0,
    amount: parseFloat(analysisResult.amount) || 0,
    assessment_article: analysisResult.assessment_article || 'No comment provided',
    contacts: analysisResult.contacts || [],
    background: analysisResult.background || '',
  };
}

function filterRelevantArticles(articles) {
  return articles.filter((article) => article.relevance_article > RELEVANCE_THRESHOLD);
}

function logAssessmentSummary(relevantArticles, allArticles) {
  logger.info('Article Assessment Summary:');
  logger.info(`Total Articles Processed: ${allArticles.length}, Relevant Articles: ${relevantArticles.length}`);
  relevantArticles.forEach((article) =>
    logger.debug(`Relevant Article - Headline: "${article.headline}", Relevance: ${article.relevance_article}`)
  );
}
