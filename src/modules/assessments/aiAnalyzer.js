// File: headlines_mongo/src/modules/assessments/aiAnalyzer.js
import { generateIntelligence } from '@daitanjs/intelligence';
import { getLogger } from '@daitanjs/development';
import { instructionArticle } from './instructionArticle.js';
import {
  shotsInput as shotsArticleInput,
  shotsOutput as shotsArticleOutput,
} from './shotsArticle.js';
import { truncateString } from '@daitanjs/utilities';
import {
  APP_LLM_PROVIDER_ARTICLES,
  APP_LLM_MODEL_ARTICLES,
  AI_VERBOSE,
} from '../../config/index.js';

const logger = getLogger('headlines-mongo-ai-article');

/**
 * Extracts and concatenates text content from the articleContent object.
 */
function extractFullArticleContent(articleContent = {}) {
  if (typeof articleContent !== 'object' || articleContent === null) {
    return '';
  }
  return Object.values(articleContent)
    .reduce((acc, val) => acc.concat(Array.isArray(val) ? val : []), [])
    .filter((text) => typeof text === 'string' && text.trim() !== '')
    .join(' \n\n ');
}

/**
 * Analyzes article content using AI to determine relevance and extract key information.
 * Uses application-configured LLM provider and model for articles.
 * @param {Object} article - The article object containing 'headline' and 'articleContent'.
 * @returns {Promise<Object>} The AI's analysis result: { relevance_article, assessment_article, topic, amount, contacts, background, error? }.
 * @throws {Error} If AI analysis call fails or returns an invalid/unexpected response.
 */
export async function analyzeArticleContentWithAI(article) {
  if (!article || typeof article !== 'object' || !article.headline) {
    const errorMsg =
      'analyzeArticleContentWithAI: Invalid article object or missing headline provided.';
    logger.error(errorMsg, {
      articleId: article?.link || 'N/A',
      articleDataPreview: truncateString(JSON.stringify(article), 100),
    });
    throw new Error(errorMsg);
  }

  const contentToAnalyze = extractFullArticleContent(article.articleContent);
  const headline = article.headline;

  if (!contentToAnalyze.trim()) {
    logger.warn(
      `analyzeArticleContentWithAI: No text content extracted from articleContent for "${truncateString(
        headline,
        50
      )}". Returning default low relevance and error message.`,
      { articleLink: article.link, articleContent: article.articleContent }
    );
    return {
      relevance_article: 0,
      assessment_article: 'No content provided to AI for analysis.',
      topic: headline,
      amount: 0,
      contacts: [],
      background: '',
      error: 'No content for AI analysis',
    };
  }

  const {
    whoYouAre,
    whatYouDo,
    writingStyle,
    outputFormatDescription,
    guidelines,
    scoring,
    vitals,
    reiteration,
    promptingTips,
  } = instructionArticle;

  // --- DEFINITIVE FIX: Do NOT parse the assistant's example output. It must remain a string. ---
  const formattedShots = shotsArticleInput.flatMap((input, index) => [
    { role: 'user', content: input.articleText },
    { role: 'assistant', content: shotsArticleOutput[index] }, // It's already a string, don't parse it.
  ]);

  const llmTarget = `${APP_LLM_PROVIDER_ARTICLES}|${APP_LLM_MODEL_ARTICLES}`;

  const generateIntelligenceParams = {
    prompt: {
      system: {
        persona: whoYouAre,
        task: whatYouDo,
        writingStyle,
        outputFormat: outputFormatDescription,
        guidelines,
        scoring,
        vitals,
        reiteration,
        promptingTips,
      },
      shots: formattedShots,
      user: contentToAnalyze,
    },
    config: {
      response: { format: 'json' },
      llm: {
        target: llmTarget,
        temperature: 0.2,
        maxTokens: 1500,
      },
      verbose: AI_VERBOSE,
    },
    metadata: {
      summary: `AI Full Article Analysis: ${truncateString(headline, 40)}`,
    },
  };

  logger.info(
    `analyzeArticleContentWithAI: Sending content for "${truncateString(
      headline,
      50
    )}" to ${llmTarget}. Content length: ${contentToAnalyze.length}`
  );

  let llmResult;

  try {
    llmResult = await generateIntelligence(generateIntelligenceParams);
  } catch (aiError) {
    logger.error(
      `analyzeArticleContentWithAI: AI service call failed for "${truncateString(
        headline,
        50
      )}" using ${llmTarget}.`,
      {
        errorMessage: aiError.message,
        stack: aiError.stack?.substring(0, 500),
        articleLink: article.link,
      }
    );
    throw aiError;
  }

  let actualAiPayload = llmResult.response;
  const llmUsageInfo = llmResult.usage;

  if (AI_VERBOSE && llmUsageInfo) {
    logger.debug(
      `LLM Usage for article "${truncateString(headline, 30)}":`,
      llmUsageInfo
    );
  }

  if (typeof actualAiPayload === 'string') {
    logger.warn(
      `analyzeArticleContentWithAI: AI response was a string, attempting to parse as JSON.`,
      { responseString: actualAiPayload }
    );
    try {
      actualAiPayload = JSON.parse(actualAiPayload);
    } catch (parseError) {
      logger.error(
        `analyzeArticleContentWithAI: Failed to parse string response from AI.`,
        {
          responseString: actualAiPayload,
          parseErrorMessage: parseError.message,
        }
      );
      throw new Error(
        `AI service returned a string that could not be parsed as JSON.`
      );
    }
  }

  if (
    !actualAiPayload ||
    typeof actualAiPayload !== 'object' ||
    Object.keys(actualAiPayload).length === 0
  ) {
    logger.error(
      `analyzeArticleContentWithAI: Invalid or empty object payload from AI for "${truncateString(
        headline,
        50
      )}".`,
      {
        responseReceived: actualAiPayload,
        llmResult,
        articleLink: article.link,
      }
    );
    throw new Error(
      `AI service returned invalid, empty, or non-object payload when JSON was expected (${JSON.stringify(
        actualAiPayload
      )}).`
    );
  }

  if (
    typeof actualAiPayload.relevance_article !== 'number' ||
    actualAiPayload.relevance_article < 0 ||
    actualAiPayload.relevance_article > 100 ||
    typeof actualAiPayload.assessment_article !== 'string' ||
    actualAiPayload.assessment_article.trim() === ''
  ) {
    logger.error(
      `analyzeArticleContentWithAI: AI response payload for "${truncateString(
        headline,
        50
      )}" is missing required fields (relevance_article, assessment_article), has incorrect types, or invalid values.`,
      { responsePayload: actualAiPayload, articleLink: article.link }
    );
    throw new Error(
      'AI response payload missing required fields, has incorrect types, or invalid values (relevance_article, assessment_article).'
    );
  }

  logger.debug(
    `analyzeArticleContentWithAI: Received valid AI analysis for "${truncateString(
      headline,
      50
    )}". Score: ${actualAiPayload.relevance_article}`
  );

  return {
    relevance_article: actualAiPayload.relevance_article,
    assessment_article: actualAiPayload.assessment_article.trim(),
    topic:
      typeof actualAiPayload.topic === 'string' && actualAiPayload.topic.trim()
        ? actualAiPayload.topic.trim()
        : headline,
    amount:
      typeof actualAiPayload.amount === 'number' &&
      !isNaN(actualAiPayload.amount)
        ? actualAiPayload.amount
        : 0,
    contacts: Array.isArray(actualAiPayload.contacts)
      ? actualAiPayload.contacts.filter(
          (c) => typeof c === 'string' && c.trim()
        )
      : [],
    background:
      typeof actualAiPayload.background === 'string'
        ? actualAiPayload.background.trim()
        : '',
    error: actualAiPayload.error || null,
  };
}
