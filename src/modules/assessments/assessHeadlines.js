// File: headlines_mongo/src/modules/assessments/assessHeadlines.js
import {
  HEADLINES_RELEVANCE_THRESHOLD,
  BATCH_SIZE as CONFIG_BATCH_SIZE,
  APP_LLM_PROVIDER_HEADLINES,
  APP_LLM_MODEL_HEADLINES,
  AI_VERBOSE,
} from '../../config/index.js';
import { getLogger } from '@daitanjs/development';
import { generateIntelligence } from '@daitanjs/intelligence';
import { instructionHeadlines } from './instructionHeadlines.js';
import {
  shotsInput as shotsHeadlinesInput,
  shotsOutput as shotsHeadlinesOutput,
} from './shotsHeadlines.js';
import {
  retryWithBackoff,
  processInBatches,
  truncateString,
} from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-assess-headlines');
const BATCH_SIZE = CONFIG_BATCH_SIZE || 5;
const MAX_AI_RETRIES = 2;

async function analyzeHeadlinesWithConfiguredAI(headlinesArray) {
  if (!Array.isArray(headlinesArray) || headlinesArray.length === 0) {
    return [];
  }
  const localAiVerbose =
    AI_VERBOSE || process.env.LOG_LEVEL_INTELLIGENCE === 'debug';

  const llmTarget = `${APP_LLM_PROVIDER_HEADLINES}|${APP_LLM_MODEL_HEADLINES}`;

  if (localAiVerbose) {
    logger.info(
      `analyzeHeadlinesWithConfiguredAI: Sending batch of ${
        headlinesArray.length
      } headlines (first: "${truncateString(
        headlinesArray[0],
        50
      )}") using ${llmTarget}`
    );
  }

  const userPromptString = `Please assess the following headlines:\n- ${headlinesArray.join(
    '\n- '
  )}`;

  const formattedShots = [];
  for (let i = 0; i < shotsHeadlinesInput.length; i++) {
    const userInput = `Please assess the following headlines:\n- ${shotsHeadlinesInput[i]}`;
    // --- DEFINITIVE FIX: Do NOT parse the assistant's example output. It must remain a string. ---
    const assistantOutput = shotsHeadlinesOutput[i];

    formattedShots.push({ role: 'user', content: userInput });
    formattedShots.push({ role: 'assistant', content: assistantOutput });
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
  } = instructionHeadlines;

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
      user: userPromptString,
    },
    config: {
      response: { format: 'json' },
      llm: {
        target: llmTarget,
        maxTokens: 4000,
        temperature: 0.2,
      },
      verbose: localAiVerbose,
    },
    metadata: {
      summary: `AI Headline Assessment for ${headlinesArray.length} headlines`,
    },
  };

  const { response: aiJsonResponse } = await generateIntelligence(
    generateIntelligenceParams
  );

  let actualAiPayload = aiJsonResponse;

  if (typeof actualAiPayload === 'string') {
    try {
      actualAiPayload = JSON.parse(actualAiPayload);
    } catch (e) {
      throw new Error('AI returned a string that is not valid JSON.');
    }
  }

  if (
    !actualAiPayload ||
    !actualAiPayload.assessment ||
    !Array.isArray(actualAiPayload.assessment)
  ) {
    logger.error(
      'analyzeHeadlinesWithConfiguredAI: Invalid AI response format. Expected an object with an "assessment" array.',
      {
        responseReceived: actualAiPayload,
        modelUsed: llmTarget,
      }
    );
    throw new Error(
      `AI service returned an invalid or malformed assessment array: ${JSON.stringify(
        actualAiPayload
      )}`
    );
  }
  logger.debug(
    `analyzeHeadlinesWithConfiguredAI: Received ${actualAiPayload.assessment.length} assessments for ${headlinesArray.length} headlines.`
  );
  return actualAiPayload.assessment;
}

export async function assessHeadlineRelevance(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    logger.warn(
      'assessHeadlineRelevance: No articles provided for assessment. Returning empty array.'
    );
    return [];
  }

  logger.info(
    `📰 Starting headline relevance assessment for ${articles.length} articles. BATCH_SIZE: ${BATCH_SIZE}, LLM: ${APP_LLM_PROVIDER_HEADLINES}/${APP_LLM_MODEL_HEADLINES}.`
  );
  const allProcessedArticles = [];

  await processInBatches(
    articles,
    BATCH_SIZE,
    async (currentBatch, batchIndex, totalBatches) => {
      const currentBatchNumber = batchIndex + 1;
      const batchHeadlines = currentBatch
        .map((article) =>
          article && article.headline
            ? article.headline.trim()
            : 'No Headline Provided For AI'
        )
        .filter((h) => h !== 'No Headline Provided For AI');

      if (batchHeadlines.length === 0) {
        logger.warn(
          `Batch ${currentBatchNumber}: Contained no valid headlines after filtering. Marking articles in batch as error.`
        );
        currentBatch.forEach((article) => {
          if (article && typeof article === 'object') {
            allProcessedArticles.push({
              ...article,
              relevance_headline: 0,
              assessment_headline:
                'Headline was missing or invalid for AI processing.',
              error: article.error || 'Missing/invalid headline for AI.',
            });
          }
        });
        return;
      }

      const firstHeadlinePreview = truncateString(batchHeadlines[0], 50);
      logger.info(
        `🧠 Batch ${currentBatchNumber}/${totalBatches}: Analyzing ${batchHeadlines.length} headlines. First: "${firstHeadlinePreview}"`
      );
      let aiAssessments;
      try {
        aiAssessments = await retryWithBackoff(
          () => analyzeHeadlinesWithConfiguredAI(batchHeadlines),
          MAX_AI_RETRIES,
          {
            loggerInstance: logger,
            operationName: `Batch ${currentBatchNumber} Headline AI`,
          }
        );
      } catch (error) {
        logger.error(
          `❌ Batch ${currentBatchNumber}: Critical failure for headline analysis (first: "${firstHeadlinePreview}") after ${MAX_AI_RETRIES} retries: ${error.message}. Marking all in this batch as error.`,
          { errorMessage: error.message, stack: error.stack?.substring(0, 300) }
        );
        currentBatch.forEach((article) => {
          if (article && typeof article === 'object') {
            allProcessedArticles.push({
              ...article,
              relevance_headline: 0,
              assessment_headline: `AI analysis failed for this batch: ${error.message}`,
              error:
                article.error ||
                `AI batch analysis failed: ${truncateString(
                  error.message,
                  100
                )}`,
            });
          }
        });
        return;
      }

      if (!Array.isArray(aiAssessments)) {
        logger.error(
          `❌ Batch ${currentBatchNumber}: AI analysis returned non-array. Expected array of assessments. Marking batch as error.`,
          { aiResponse: aiAssessments }
        );
        currentBatch.forEach((article) => {
          if (article && typeof article === 'object') {
            allProcessedArticles.push({
              ...article,
              relevance_headline: 0,
              assessment_headline: 'AI non-array response.',
              error: article.error || 'AI non-array response.',
            });
          }
        });
        return;
      }

      let aiAssessmentIdx = 0;
      currentBatch.forEach((article) => {
        if (!article || typeof article !== 'object') return;

        let relevance = 0;
        let assessmentText = 'Assessment not performed or error occurred.';
        let errorForThisArticle = article.error || null;

        if (
          article.headline &&
          article.headline.trim() !== '' &&
          article.headline.trim() !== 'No Headline Provided For AI'
        ) {
          if (aiAssessmentIdx < aiAssessments.length) {
            const singleAiAssessment = aiAssessments[aiAssessmentIdx];
            if (
              singleAiAssessment &&
              typeof singleAiAssessment === 'object' &&
              typeof singleAiAssessment.relevance_headline === 'number' &&
              typeof singleAiAssessment.assessment_headline === 'string'
            ) {
              relevance = Math.max(
                0,
                Math.min(
                  100,
                  parseInt(String(singleAiAssessment.relevance_headline), 10)
                )
              );
              assessmentText = singleAiAssessment.assessment_headline.trim();
              if (isNaN(relevance)) {
                errorForThisArticle =
                  errorForThisArticle ||
                  `AI returned non-numeric relevance: ${singleAiAssessment.relevance_headline}`;
                relevance = 0;
              }
            } else {
              errorForThisArticle =
                errorForThisArticle ||
                'Invalid AI assessment structure for this headline.';
              logger.warn(
                `⚠️ Batch ${currentBatchNumber}, Article "${truncateString(
                  article.headline,
                  30
                )}": ${errorForThisArticle}. AI data:`,
                singleAiAssessment
              );
            }
            aiAssessmentIdx++;
          } else {
            errorForThisArticle =
              errorForThisArticle ||
              'Mismatch: More headlines in batch than AI assessments received.';
            logger.warn(
              `⚠️ Batch ${currentBatchNumber}, Article "${truncateString(
                article.headline,
                30
              )}": ${errorForThisArticle}`
            );
          }
        } else {
          errorForThisArticle =
            errorForThisArticle || 'Missing/invalid headline (not sent to AI).';
          assessmentText =
            'Headline was missing or invalid for AI processing (not sent).';
        }

        if (
          errorForThisArticle &&
          assessmentText === 'Assessment not performed or error occurred.'
        ) {
          assessmentText = errorForThisArticle;
        }

        allProcessedArticles.push({
          ...article,
          relevance_headline: relevance,
          assessment_headline: assessmentText,
          error: errorForThisArticle,
        });
      });
    },
    { loggerInstance: logger }
  );

  logHeadlineAssessmentSummary(allProcessedArticles, articles.length);
  return allProcessedArticles;
}

function logHeadlineAssessmentSummary(
  allProcessedArticles,
  totalArticlesInput
) {
  const successfullyAssessedForHeadline = allProcessedArticles.filter(
    (a) => a && typeof a.relevance_headline === 'number' && !a.error
  );
  const relevantCount = successfullyAssessedForHeadline.filter(
    (a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
  ).length;
  const errorDuringAIAssessmentCount = allProcessedArticles.filter(
    (a) =>
      a &&
      a.error &&
      (a.error.includes('AI') || a.error.includes('batch analysis'))
  ).length;
  const missingHeadlineForAICount = allProcessedArticles.filter(
    (a) => a && a.error && a.error.includes('Missing/invalid headline')
  ).length;

  logger.info('\n📊 Headline Relevance Assessment Summary:');
  logger.info(
    `   - Total articles submitted to this step: ${totalArticlesInput}`
  );
  logger.info(
    `   - Articles with AI headline assessment data: ${allProcessedArticles.length}`
  );
  logger.info(
    `   - Successfully AI-assessed (valid score, no new error in this step): ${successfullyAssessedForHeadline.length}`
  );
  logger.info(
    `   - Deemed relevant by headline (score >=${HEADLINES_RELEVANCE_THRESHOLD}): ${relevantCount}`
  );
  logger.info(
    `   - Errors during AI assessment processing: ${errorDuringAIAssessmentCount}`
  );
  logger.info(
    `   - Skipped by AI due to missing/invalid headline: ${missingHeadlineForAICount}`
  );

  logger.info('\n👍👎 Individual Headline Assessments:');
  allProcessedArticles.forEach((article, idx) => {
    if (!article || typeof article.relevance_headline !== 'number') {
      logger.info(
        `  ${idx + 1}. [NO SCORE] "${truncateString(
          String(article?.headline),
          50
        )}" - Error: ${truncateString(
          String(article?.error || article?.assessment_headline),
          60
        )}`
      );
      return;
    }
    const emoji =
      article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD ? '👍' : '👎';
    logger.info(
      `  ${idx + 1}. ${emoji} [${article.relevance_headline}] "${truncateString(
        article.headline,
        50
      )}" → "${truncateString(article.assessment_headline, 60)}" (Source: ${
        article.newspaper || article.source || 'N/A'
      })`
    );
  });

  if (successfullyAssessedForHeadline.length > 0) {
    const relevanceRate = (
      (relevantCount / successfullyAssessedForHeadline.length) *
      100
    ).toFixed(2);
    logger.info(
      `   - Headline relevance rate (of successfully AI-assessed): ${
        relevanceRate > 0 ? relevanceRate : '0.00'
      }%`
    );

    const topArticles = [...successfullyAssessedForHeadline]
      .sort((a, b) => (b.relevance_headline || 0) - (a.relevance_headline || 0))
      .slice(0, 5);
    if (
      topArticles.length > 0 &&
      (topArticles[0].relevance_headline || 0) > 0
    ) {
      logger.info(
        `🏆 Top ${topArticles.length} headlines by relevance (successfully assessed):`
      );
      topArticles.forEach((article, idx) => {
        logger.info(
          `  ${idx + 1}. [${article.relevance_headline}] "${truncateString(
            article.headline,
            60
          )}" (Source: ${article.newspaper || article.source || 'N/A'})`
        );
      });
    } else {
      logger.info(
        '🏅 No headlines scored above 0 for relevance among successfully assessed ones.'
      );
    }
  } else {
    logger.info(
      '🏅 No headlines were successfully AI-assessed in this run for detailed stats.'
    );
  }
}
