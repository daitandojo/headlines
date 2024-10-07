import { construct, generateIntelligence } from 'daitanjs/intelligence';
import { getLogger } from 'daitanjs/development';
import { instructionArticle } from './instructionArticle.js';
import { shotsInput, shotsOutput } from './shotsArticle.js';
import pLimit from 'p-limit';
import { RELEVANCE_THRESHOLD } from '../../config/config.js';
import { safeExecute } from 'daitanjs/error';

const logger = getLogger('article-assessment');
const limit = pLimit(5);

// Extract article content
const extractArticleContent = ({ headlines = [], subheadings = [], captions = [], contents = [] }) =>
  [headlines.join('. '), subheadings.join('. '), captions.join('. '), contents.join('. ')]
    .filter(Boolean)
    .join('. ');

// Analyze the body of the article using OpenAI
async function analyzeBody(textToAnalyse) {
  return await safeExecute(async () => {
    const messages = construct({
      instructionArticle,
      shotsInput,
      shotsOutput,
      prompt: textToAnalyse,
    });

    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      summary: 'Article body - wealth analysis',
      messages,
      max_tokens: 1500,
    });

    if (!response) {
      throw new Error('No response from OpenAI service.');
    }

    return { ...response, result: 'success' };
  }, (error) => logger.error('Error occurred during body analysis', { error }));
}

async function analyzeArticleObjectBody(articleObject) {
  const fullArticle = extractArticleContent(articleObject.articleContent);

  if (fullArticle.length < 10) {
    logger.warn('Article content is too short to analyze:', { fullArticle });
    return {
      relevance_article: 0,
      assessment_article: 'ARTICLE TOO SHORT TO ANALYZE',
    };
  }

  logger.info('Prompting OpenAI with the article content...');
  const result = await analyzeBody(fullArticle);

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    logger.error('Invalid or missing response from analyzeBody function.', { result });
    return {
      relevance_article: 0,
      assessment_article: 'INVALID OR MISSING ANALYSIS RESULT',
    };
  }

  return {
    topic: result.topic || 'Unknown',
    relevance_article: result.relevance_article || 0,
    amount: parseFloat(result.amount) || 0,
    assessment_article: result.assessment_article || 'No comment provided',
    contacts: result.contacts || [],
    background: result.background || '',
  };
}

async function assessArrayOfArticles(articleObjects) {
  if (!Array.isArray(articleObjects)) {
    logger.error('Input is not an array', { input: articleObjects });
    return []; // Return an empty array to maintain consistency
  }

  logger.info(`Received ${articleObjects.length} articles for assessment.`);

  try {
    const assessedArticles = await Promise.all(
      articleObjects.map((articleObject) =>
        limit(() =>
          safeExecute(async () => {
            const articleBodyAnalysis = await analyzeArticleObjectBody(articleObject);
            logger.info(`Article body assessed: Relevance - ${
              articleBodyAnalysis.relevance_article
            } ${
              articleObject.headline || 'No headline provided'
            }`
          );
            return { ...articleObject, ...articleBodyAnalysis };
          }, (error) => {
            logger.error(`Error analyzing article for: ${articleObject.headline}`, { error });
            return { ...articleObject, relevance_article: 0, assessment_article: 'ANALYSIS FAILED' }; // Include default values to maintain consistency
          })
        )
      )
    );

    // Filter articles based on relevance threshold
    const relevantArticles = assessedArticles.filter((article) => article.relevance_article > RELEVANCE_THRESHOLD);

    logger.info(`Assessment completed. ${relevantArticles.length}/${assessedArticles.length} articles relevant.`);

    return relevantArticles; // Return only relevant articles
  } catch (error) {
    logger.error('Unhandled error in assessArrayOfArticles', { error });
    return []; // Ensure an empty array is returned in case of failure
  }
}

export { assessArrayOfArticles, analyzeArticleObjectBody };
