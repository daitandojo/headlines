// File: app-logic.js (Instrumented)
import { getLogger } from '@daitanjs/development';
import { truncateString } from '@daitanjs/utilities';

const pipelineLogger = getLogger('headlines-mongo-pipeline');

// --- (logPipelineDuration and logFinalSummary functions remain the same) ---
function logPipelineDuration(startTime, message) {
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  pipelineLogger.info(
    `${message} Pipeline processing completed in ${duration} seconds.`
  );
}
function logFinalSummary(articles, articlesRelevanceThreshold, headlinesRelevanceThreshold) {
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
        pipelineLogger.info('🏁 No articles available to summarize at the end of the pipeline.'); return;
    }
    const relevantForSummary = articles.filter((article) => {
        if (!article || typeof article !== 'object') return false;
        const hasContentError = !!(article.error && article.error !== 'Insufficient content') || !!article.enrichment_error;
        const isArticleContentRelevant = !hasContentError && article.relevance_article !== undefined && article.relevance_article !== null && article.relevance_article >= articlesRelevanceThreshold;
        const isHeadlineSufficientForEmailOnError = hasContentError && article.relevance_headline !== undefined && article.relevance_headline !== null && article.relevance_headline >= headlinesRelevanceThreshold;
        return isArticleContentRelevant || isHeadlineSufficientForEmailOnError;
    });
    if (relevantForSummary.length === 0) {
        pipelineLogger.info('🏁 No articles met final relevance criteria for this summary log.'); return;
    }
    pipelineLogger.info(`📋 Final Summary of ${relevantForSummary.length} Processed Articles Marked as Relevant for Action/Email:`);
    relevantForSummary.forEach((article, index) => {
        pipelineLogger.info(`  Article #${index + 1}: Headline: ${truncateString(article.headline, 100)}`);
    });
}

export async function executePipeline() {
  console.log('[DIAGNOSTIC] TOP of executePipeline function entered.');
  const startTime = Date.now();
  pipelineLogger.info('🚀🚀🚀 Executing Headlines Processing Pipeline... 🚀🚀🚀');

  let pipelineModules;

  try {
    console.log('[DIAGNOSTIC] executePipeline: PRE-AWAIT dynamic imports.');
    pipelineModules = {
      fetchAllHeadlines: (await import('./src/modules/scraping/fetchHeadlines.js')).fetchAllHeadlines,
      filterFreshArticles: (await import('./src/modules/mongoStore/articleOperations.js')).filterFreshArticles,
      assessHeadlineRelevance: (await import('./src/modules/assessments/assessHeadlines.js')).assessHeadlineRelevance,
      storeInitialHeadlineData: (await import('./src/modules/mongoStore/articleOperations.js')).storeInitialHeadlineData,
      enrichWithArticleBody: (await import('./src/modules/scraping/enrichWithBody.js')).enrichWithArticleBody,
      assessArrayOfArticles: (await import('./src/modules/assessments/assessArticles.js')).assessArrayOfArticles,
      storeRelevantArticles: (await import('./src/modules/mongoStore/articleOperations.js')).storeRelevantArticles,
      sendWealthEventsEmail: (await import('./src/modules/email/index.js')).sendWealthEventsEmail,
      sendSupervisorReportEmail: (await import('./src/modules/email/index.js')).sendSupervisorReportEmail,
    };
    console.log('[DIAGNOSTIC] executePipeline: POST-AWAIT dynamic imports. All modules loaded.');

    // ... (rest of the function, including runStats setup, remains the same)
    let articles = [];
    let allFreshlyAssessedHeadlines = [];
    let currentArticles = [];
    let runStats = {};
    const { HEADLINES_RELEVANCE_THRESHOLD, ARTICLES_RELEVANCE_THRESHOLD } = await import('./src/config/index.js');
    runStats = { startTime: new Date().toISOString(), totalFetched: 0, totalFresh: 0, totalAssessedForHeadline: 0, passedHeadlineThreshold: 0, enrichedSuccessfully: 0, passedArticleThreshold: 0, sentInWealthEventsEmail: 0, dbInitialStoreSuccess: 0, dbFinalStoreSuccess: 0, pipelineError: null };
    
    const workflowSteps = [
        { name: 'Fetch Headlines', func: pipelineModules.fetchAllHeadlines, postProcess: (result) => { runStats.totalFetched = result?.length || 0; if (!result || result.length === 0) { logPipelineDuration(startTime, '⏹️ No headlines fetched.'); return null; } pipelineLogger.info(`📰 Fetched ${result.length} headlines.`); return result; }},
        { name: 'Filter Fresh Articles', func: pipelineModules.filterFreshArticles, postProcess: (result) => { runStats.totalFresh = result?.length || 0; if (!result || result.length === 0) { logPipelineDuration(startTime, '⏹️ No fresh articles to process.'); return null; } pipelineLogger.info(`🆕 Found ${result.length} fresh articles not in DB.`); return result; }},
        { name: 'Assess Headline Relevance', func: pipelineModules.assessHeadlineRelevance, postProcess: (result) => { allFreshlyAssessedHeadlines = result ? [...result] : []; runStats.totalAssessedForHeadline = result?.length || 0; const successfullyAssessed = result.filter((a) => a && !a.error); runStats.passedHeadlineThreshold = successfullyAssessed.filter( (a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD ).length; pipelineLogger.info(`🧐 ${successfullyAssessed.length} headlines AI-assessed. ${runStats.passedHeadlineThreshold} passed threshold.`); if (successfullyAssessed.length === 0 && result.length > 0) { logPipelineDuration(startTime, '⏹️ All articles had errors during headline AI assessment.'); return null; } return successfullyAssessed; }},
        { name: 'Store Initial Headline Data', func: pipelineModules.storeInitialHeadlineData, postProcess: (result) => { if (!result || result.length === 0) { logPipelineDuration(startTime, '⏹️ No initial headline data to process for storage.'); return null; } const storedOrUpdated = result.filter((a) => a && !a.storage_error_initial_headline_data); runStats.dbInitialStoreSuccess = storedOrUpdated.length; const forEnrichment = storedOrUpdated.filter((a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD); if (forEnrichment.length === 0) { logPipelineDuration(startTime, `⏹️ No articles passed headline relevance (>=${HEADLINES_RELEVANCE_THRESHOLD}) for enrichment.`); return null; } pipelineLogger.info(`📝 ${forEnrichment.length} articles proceeding to content enrichment.`); return forEnrichment; }},
        { name: 'Enrich with Article Body', func: pipelineModules.enrichWithArticleBody, postProcess: (result) => { if (!result) return null; runStats.enrichedSuccessfully = result.filter(a => a && !a.enrichment_error).length; return result; } },
        { name: 'Assess Full Article Content', func: pipelineModules.assessArrayOfArticles, postProcess: (result) => { if (!result) return null; const forFinalStore = result.filter(article => { const hasError = !!(article.error && article.error !== 'Insufficient content') || !!article.enrichment_error; const isContentRelevant = !hasError && article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD; const isHeadlineSufficient = hasError && article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD; return isContentRelevant || isHeadlineSufficient; }); if (forFinalStore.length === 0) { pipelineLogger.info(`⏹️ No articles passed final relevance for storage.`); return result; } return forFinalStore; }},
        { name: 'Store Relevant Articles', func: pipelineModules.storeRelevantArticles, postProcess: (result) => { if (!result) return null; runStats.dbFinalStoreSuccess = result.filter(r => r && ['inserted', 'updated', 'no_change'].includes(r.db_operation_status)).length; return result; } },
        { name: 'Send Wealth Events Email', func: pipelineModules.sendWealthEventsEmail, postProcess: (result) => { if (!result) return null; runStats.sentInWealthEventsEmail = result.filter(a => a && a.emailed).length; return result; } }
    ];

    for (const step of workflowSteps) {
      console.log(`[DIAGNOSTIC] app-logic: PRE-AWAIT step: ${step.name}`);
      const stepInput = Array.isArray(currentArticles) ? currentArticles : [];
      const stepRawResult = await step.func(stepInput);
      console.log(`[DIAGNOSTIC] app-logic: POST-AWAIT step: ${step.name}.`);
      
      if (step.name === 'Assess Headline Relevance') allFreshlyAssessedHeadlines = stepRawResult ? [...stepRawResult] : [];
      if (step.postProcess) {
          currentArticles = await step.postProcess(stepRawResult);
          if (currentArticles === null) {
              pipelineLogger.info(`Pipeline stopped at step "${step.name}".`);
              break;
          }
      } else { currentArticles = stepRawResult; }
    }
    console.log('[DIAGNOSTIC] app-logic: Workflow loop completed.');

    // ... (rest of the function remains the same)
    articles = currentArticles !== null ? (Array.isArray(currentArticles) ? currentArticles : allFreshlyAssessedHeadlines) : allFreshlyAssessedHeadlines;
    logFinalSummary(articles, ARTICLES_RELEVANCE_THRESHOLD, HEADLINES_RELEVANCE_THRESHOLD);
    if (currentArticles !== null) logPipelineDuration(startTime, '🎉 News Processing Pipeline finished successfully.');
    return { success: true, stats: runStats, articles };

  } catch (error) {
    console.error('[DIAGNOSTIC] CATCH block in executePipeline:', error);
    pipelineLogger.error('💥💥💥 CRITICAL PIPELINE FAILURE 💥💥💥');
    pipelineLogger.error(error.message, { stack: error.stack });
    runStats.pipelineError = `Main flow error: ${error.message}`;
    logPipelineDuration(startTime, '❌ Pipeline terminated due to a critical error.');
    articles = Array.isArray(currentArticles) && currentArticles.length > 0 ? currentArticles : allFreshlyAssessedHeadlines;
    return { success: false, error, stats: runStats, articles };
  } finally {
    console.log('[DIAGNOSTIC] FINALLY block in executePipeline reached.');
    pipelineLogger.info('[PIPELINE] FINALLY block reached. Sending supervisor report.');
    try {
        let reportableArticles = allFreshlyAssessedHeadlines.map(initialArticle => {
            if (!initialArticle || !initialArticle.link) return null;
            const finalArticleState = Array.isArray(currentArticles) ? currentArticles.find(fa => fa && fa.link === initialArticle.link) : null;
            return finalArticleState ? { ...initialArticle, ...finalArticleState } : initialArticle;
        }).filter(Boolean);
        if (reportableArticles.length === 0 && Array.isArray(articles) && articles.length > 0) {
            reportableArticles = articles;
        }
        if (pipelineModules && pipelineModules.sendSupervisorReportEmail) {
            await pipelineModules.sendSupervisorReportEmail(reportableArticles, runStats);
        } else {
            pipelineLogger.error('sendSupervisorReportEmail module not loaded.');
        }
    } catch (supervisorEmailError) {
      pipelineLogger.error('💥 Error sending supervisor report email:', { supervisorError: supervisorEmailError.message });
    }
    pipelineLogger.info('🏁 Pipeline execution sequence ended.');
  }
}