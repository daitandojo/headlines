// File: app-logic.js
// This file was formerly app.js. It contains the main application pipeline.
import {
  getLogger,
  setGlobalLogLevel,
  loadEnvironmentFiles,
} from '@daitanjs/development';
import { initializeConfigManager } from '@daitanjs/config';
import { truncateString } from '@daitanjs/utilities';

const appLogger = getLogger('headlines-mongo-main');

async function mainApp() {
  appLogger.info('Application starting: Loading environment variables...');
  loadEnvironmentFiles({
    loggerInstance: appLogger,
    override: true,
  });
  const initialLogLevel = process.env.LOG_LEVEL || 'info';
  setGlobalLogLevel(initialLogLevel);

  appLogger.info('Initializing DaitanJS configuration manager...');
  initializeConfigManager({ loggerInstance: appLogger });
  appLogger.info('DaitanJS configuration initialized.');

  const {
    LOG_LEVEL,
    HEADLINES_RELEVANCE_THRESHOLD,
    ARTICLES_RELEVANCE_THRESHOLD,
  } = await import('./src/config/index.js');

  if (LOG_LEVEL && LOG_LEVEL !== initialLogLevel) {
    setGlobalLogLevel(LOG_LEVEL);
  }

  let pipelineModules;

  async function loadPipelineModules() {
    appLogger.info('🔄 Loading pipeline modules...');
    try {
      const modules = {
        fetchAllHeadlines: (
          await import('./src/modules/scraping/fetchHeadlines.js')
        ).fetchAllHeadlines,
        filterFreshArticles: (
          await import('./src/modules/mongoStore/articleOperations.js')
        ).filterFreshArticles,
        assessHeadlineRelevance: (
          await import('./src/modules/assessments/assessHeadlines.js')
        ).assessHeadlineRelevance,
        storeInitialHeadlineData: (
          await import('./src/modules/mongoStore/articleOperations.js')
        ).storeInitialHeadlineData,
        enrichWithArticleBody: (
          await import('./src/modules/scraping/enrichWithBody.js')
        ).enrichWithArticleBody,
        assessArrayOfArticles: (
          await import('./src/modules/assessments/assessArticles.js')
        ).assessArrayOfArticles,
        storeRelevantArticles: (
          await import('./src/modules/mongoStore/articleOperations.js')
        ).storeRelevantArticles,
        sendWealthEventsEmail: (await import('./src/modules/email/index.js'))
          .sendWealthEventsEmail,
        sendSupervisorReportEmail: (
          await import('./src/modules/email/index.js')
        ).sendSupervisorReportEmail,
      };
      appLogger.info('✅ All pipeline modules loaded successfully.');
      return modules;
    } catch (err) {
      appLogger.error(
        '💥 CRITICAL: Error loading one or more pipeline modules.',
        { moduleLoadError: err.message, stack: err.stack }
      );
      throw err;
    }
  }

  function logPipelineCompletion(startTime, message, exitCode = 0) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    appLogger.info(
      `${message} Pipeline processing completed in ${duration} seconds.`
    );
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exitCode = exitCode;
    }
  }

  function logFinalSummary(articles) {
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      appLogger.info(
        '🏁 No articles available to summarize at the end of the pipeline.'
      );
      return;
    }
    const relevantForSummary = articles.filter((article) => {
      if (!article || typeof article !== 'object') return false;
      const hasContentError =
        !!(article.error && article.error !== 'Insufficient content') ||
        !!article.enrichment_error;
      const isArticleContentRelevant =
        !hasContentError &&
        article.relevance_article !== undefined &&
        article.relevance_article !== null &&
        article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD;
      const isHeadlineSufficientForEmailOnError =
        hasContentError &&
        article.relevance_headline !== undefined &&
        article.relevance_headline !== null &&
        article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD;
      return isArticleContentRelevant || isHeadlineSufficientForEmailOnError;
    });

    if (relevantForSummary.length === 0) {
      appLogger.info(
        '🏁 No articles met final relevance criteria for this summary log.'
      );
      return;
    }
    appLogger.info(
      `📋 Final Summary of ${relevantForSummary.length} Processed Articles Marked as Relevant for Action/Email:`
    );
    appLogger.info(
      '----------------------------------------------------------------------'
    );
    relevantForSummary.forEach((article, index) => {
      appLogger.info(`  Article #${index + 1}:`);
      appLogger.info(
        `    - Headline: ${truncateString(article.headline, 100)}`
      );
      appLogger.info(`    - Link: ${article.link}`);
      appLogger.info(
        `    - Source: ${article.newspaper || article.source || 'N/A'}`
      );
      appLogger.info(
        `    - Headline Relevance: ${
          article.relevance_headline ?? 'N/A'
        } (Assessment: ${
          truncateString(String(article.assessment_headline ?? ''), 80) || 'N/A'
        })`
      );
      if (
        article.relevance_article !== undefined &&
        article.relevance_article !== null
      ) {
        appLogger.info(
          `    - Article Relevance: ${article.relevance_article} (Assessment: ${
            truncateString(String(article.assessment_article ?? ''), 80) ||
            'N/A'
          })`
        );
      } else if (article.error || article.enrichment_error) {
        appLogger.info(
          `    - Article Relevance: Not assessed due to content issues.`
        );
      }
      if (article.error)
        appLogger.warn(`    - Processing Error: ${article.error}`);
      if (article.enrichment_error)
        appLogger.warn(`    - Enrichment Error: ${article.enrichment_error}`);
      if (article.emailed) appLogger.info(`    - Email Status: Sent`);
      else if (article.email_error)
        appLogger.warn(`    - Email Status: Error - ${article.email_error}`);
      else if (article.email_skipped_reason)
        appLogger.info(
          `    - Email Status: Skipped - ${article.email_skipped_reason}`
        );
      appLogger.info(
        '----------------------------------------------------------------------'
      );
    });
  }

  process.on('unhandledRejection', (reason, promise) => {
    appLogger.error('💥 FATAL: Unhandled Rejection at:', {
      promiseDetails: String(promise),
      reason:
        reason instanceof Error
          ? { message: reason.message, stack: reason.stack }
          : String(reason),
    });
    if (pipelineModules && pipelineModules.sendSupervisorReportEmail) {
      pipelineModules
        .sendSupervisorReportEmail([], {
          pipelineError: `UnhandledRejection: ${
            reason instanceof Error ? reason.message : String(reason)
          }`,
          errorType: 'UnhandledRejection',
          errorMessage:
            reason instanceof Error ? reason.message : String(reason),
          errorStack: reason instanceof Error ? reason.stack : 'N/A',
        })
        .catch((err) =>
          appLogger.error(
            'Failed to send emergency supervisor email for UnhandledRejection:',
            { emailError: err.message }
          )
        )
        .finally(() => setTimeout(() => process.exit(1), 2000));
    } else {
      appLogger.error(
        'pipelineModules not available for emergency supervisor email (Unhandled Rejection).'
      );
      setTimeout(() => process.exit(1), 2000);
    }
  });

  process.on('uncaughtException', (error) => {
    appLogger.error('💥 FATAL: Uncaught Exception:', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
    if (pipelineModules && pipelineModules.sendSupervisorReportEmail) {
      pipelineModules
        .sendSupervisorReportEmail([], {
          pipelineError: `UncaughtException: ${error.message}`,
          errorType: 'UncaughtException',
          errorMessage: error.message,
          errorStack: error.stack,
        })
        .catch((err) =>
          appLogger.error(
            'Failed to send emergency supervisor email for UncaughtException:',
            { emailError: err.message }
          )
        )
        .finally(() => setTimeout(() => process.exit(1), 2000));
    } else {
      appLogger.error(
        'pipelineModules not available for emergency supervisor email (Uncaught Exception).'
      );
      setTimeout(() => process.exit(1), 2000);
    }
  });

  async function runPipeline() {
    const startTime = Date.now();
    appLogger.info('🚀 Headlines Processing Pipeline Started...');
    process.exitCode = 0;

    let articles = [];
    let allFreshlyAssessedHeadlines = [];
    let currentArticles = [];
    let runStats = {};

    const { setupApp } = await import('./src/setup/setupApp.js');
    const { connectDatabase } = await import('./src/config/database.js');
    const { validateAllSourceConfigs } = await import(
      './src/utils/configValidator.js'
    );

    try {
      pipelineModules = await loadPipelineModules();

      if (!validateAllSourceConfigs()) {
        throw new Error('Source configuration validation failed.');
      }
      appLogger.info('✅ Source configurations validated successfully.');

      appLogger.info('⚙️  Initializing application setup...');
      await setupApp();
      appLogger.info('✅ Application setup checks complete.');

      appLogger.info('📡 Attempting initial connection to MongoDB...');
      await connectDatabase();
      appLogger.info('✅ MongoDB initial connection successful.');

      runStats = {
        startTime: new Date().toISOString(),
        totalFetched: 0,
        totalFresh: 0,
        totalAssessedForHeadline: 0,
        passedHeadlineThreshold: 0,
        enrichedSuccessfully: 0,
        contentAssessmentErrors: 0,
        passedArticleThreshold: 0,
        sentInWealthEventsEmail: 0,
        dbInitialStoreSuccess: 0,
        dbFinalStoreSuccess: 0,
        pipelineError: null,
      };

      const workflowSteps = [
        {
          name: 'Fetch Headlines',
          func: pipelineModules.fetchAllHeadlines,
          postProcess: (result) => {
            runStats.totalFetched = result?.length || 0;
            if (!result || result.length === 0) {
              logPipelineCompletion(startTime, '⏹️ No headlines fetched.');
              return null;
            }
            appLogger.info(`📰 Fetched ${result.length} headlines.`);
            return result;
          },
        },
        {
          name: 'Filter Fresh Articles',
          func: pipelineModules.filterFreshArticles,
          postProcess: (result) => {
            runStats.totalFresh = result?.length || 0;
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ No fresh articles to process.'
              );
              return null;
            }
            appLogger.info(
              `🆕 Found ${result.length} fresh articles not in DB.`
            );
            return result;
          },
        },
        {
          name: 'Assess Headline Relevance',
          func: pipelineModules.assessHeadlineRelevance,
          postProcess: (result) => {
            allFreshlyAssessedHeadlines = result ? [...result] : [];
            runStats.totalAssessedForHeadline = result?.length || 0;
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ No articles for headline assessment.'
              );
              return null;
            }
            const successfullyAssessed = result.filter(
              (article) => article && !article.error
            );
            runStats.passedHeadlineThreshold = successfullyAssessed.filter(
              (a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
            ).length;
            appLogger.info(
              `🧐 ${successfullyAssessed.length} headlines AI-assessed. ${runStats.passedHeadlineThreshold} passed threshold.`
            );
            if (successfullyAssessed.length === 0 && result.length > 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ All articles had errors during headline AI assessment.'
              );
              return null;
            }
            return successfullyAssessed;
          },
        },
        {
          name: 'Store Initial Headline Data',
          func: pipelineModules.storeInitialHeadlineData,
          postProcess: (result) => {
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ No initial headline data to process for storage.'
              );
              return null;
            }
            const storedOrUpdatedSuccessfully = result.filter(
              (a) => a && !a.storage_error_initial_headline_data
            );
            runStats.dbInitialStoreSuccess = storedOrUpdatedSuccessfully.length;
            appLogger.info(
              `💾 ${storedOrUpdatedSuccessfully.length} articles had initial data stored.`
            );
            const articlesForEnrichment = storedOrUpdatedSuccessfully.filter(
              (a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
            );
            if (articlesForEnrichment.length === 0) {
              logPipelineCompletion(
                startTime,
                `⏹️ No articles passed headline relevance (>=${HEADLINES_RELEVANCE_THRESHOLD}) for enrichment.`
              );
              return null;
            }
            appLogger.info(
              `📝 ${articlesForEnrichment.length} articles proceeding to content enrichment.`
            );
            return articlesForEnrichment;
          },
        },
        {
          name: 'Enrich with Article Body',
          func: pipelineModules.enrichWithArticleBody,
          postProcess: (result) => {
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ No articles available for enrichment.'
              );
              return null;
            }
            const successfullyEnriched = result.filter(
              (a) =>
                a &&
                !a.enrichment_error &&
                a.articleContent &&
                Object.keys(a.articleContent).length > 0 &&
                (!a.error || a.error === 'Insufficient content')
            );
            runStats.enrichedSuccessfully = successfullyEnriched.length;
            const enrichmentFailures =
              result.length - successfullyEnriched.length;
            appLogger.info(
              `📝 Content enrichment: Successful: ${successfullyEnriched.length}, Failures/Empty: ${enrichmentFailures}.`
            );
            if (result.length > 0 && successfullyEnriched.length === 0) {
              logPipelineCompletion(
                startTime,
                `⏹️ All articles failed content enrichment.`
              );
              return result;
            }
            return result;
          },
        },
        {
          name: 'Assess Full Article Content',
          func: pipelineModules.assessArrayOfArticles,
          postProcess: (result) => {
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                `⏹️ No articles for full content assessment.`
              );
              return null;
            }
            runStats.contentAssessmentErrors = result.filter(
              (a) => a && a.error && a.error.toLowerCase().includes('ai error')
            ).length;
            const validAssessments = result.filter(
              (a) =>
                a &&
                (!a.error || a.error === 'Insufficient content') &&
                a.relevance_article !== undefined &&
                a.relevance_article !== null
            );
            runStats.passedArticleThreshold = validAssessments.filter(
              (a) => a.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD
            ).length;
            const articlesForFinalStore = result.filter((article) => {
              if (!article) return false;
              const hasContentError =
                !!(article.error && article.error !== 'Insufficient content') ||
                !!article.enrichment_error ||
                !!(
                  article.error &&
                  article.error.toLowerCase().includes('ai error')
                );
              const isContentRelevant =
                !hasContentError &&
                article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD;
              const isHeadlineSufficientOnError =
                hasContentError &&
                article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD;
              return isContentRelevant || isHeadlineSufficientOnError;
            });
            if (articlesForFinalStore.length === 0) {
              logPipelineCompletion(
                startTime,
                `⏹️ No articles passed final relevance for storage.`
              );
              return result;
            }
            appLogger.info(
              `📊 ${articlesForFinalStore.length} articles proceeding to final storage.`
            );
            return articlesForFinalStore;
          },
        },
        {
          name: 'Store Relevant Articles',
          func: pipelineModules.storeRelevantArticles,
          postProcess: (result) => {
            if (!result || result.length === 0) {
              logPipelineCompletion(
                startTime,
                '⏹️ No articles for final storage step.'
              );
              return [];
            }
            runStats.dbFinalStoreSuccess = result.filter(
              (r) =>
                r &&
                ['inserted', 'updated', 'no_change'].includes(
                  r.db_operation_status
                )
            ).length;
            appLogger.info(
              `💾 Successfully processed ${runStats.dbFinalStoreSuccess} articles in final DB step.`
            );
            return result;
          },
        },
        {
          name: 'Send Wealth Events Email',
          func: pipelineModules.sendWealthEventsEmail,
          postProcess: (resultWithEmailStatus) => {
            if (!resultWithEmailStatus || resultWithEmailStatus.length === 0) {
              appLogger.info('📧 No articles processed by email module.');
              return [];
            }
            runStats.sentInWealthEventsEmail = resultWithEmailStatus.filter(
              (a) => a && a.emailed
            ).length;
            if (runStats.sentInWealthEventsEmail > 0) {
              appLogger.info(
                `📧 Wealth events email sent with ${runStats.sentInWealthEventsEmail} articles.`
              );
            } else {
              appLogger.info(
                '📧 No articles met criteria for wealth events email.'
              );
            }
            return resultWithEmailStatus;
          },
        },
      ];

      for (const step of workflowSteps) {
        appLogger.info(`⏳ Processing step: ${step.name}...`);
        try {
          const stepInput = Array.isArray(currentArticles)
            ? currentArticles
            : allFreshlyAssessedHeadlines || [];
          const stepRawResult = await step.func(stepInput);

          if (step.name === 'Assess Headline Relevance') {
            allFreshlyAssessedHeadlines = stepRawResult
              ? [...stepRawResult]
              : [];
          }

          if (step.postProcess) {
            currentArticles = await step.postProcess(stepRawResult);
            if (currentArticles === null) {
              appLogger.info(`Pipeline stopped at step "${step.name}".`);
              break;
            }
          } else {
            currentArticles = stepRawResult;
          }
        } catch (errorInStep) {
          appLogger.error(
            `💥 CRITICAL ERROR in pipeline step "${step.name}":`,
            {
              errorMessage: errorInStep.message,
              stack: errorInStep.stack?.substring(0, 500),
            }
          );
          runStats.pipelineError = `Error in step ${step.name}: ${errorInStep.message}`;
          articles =
            Array.isArray(currentArticles) && currentArticles.length > 0
              ? currentArticles
              : allFreshlyAssessedHeadlines;
          throw errorInStep;
        }
      }

      articles =
        currentArticles !== null
          ? Array.isArray(currentArticles)
            ? currentArticles
            : allFreshlyAssessedHeadlines
          : allFreshlyAssessedHeadlines;

      logFinalSummary(articles);
      if (process.exitCode === 0 && currentArticles !== null) {
        logPipelineCompletion(
          startTime,
          '🎉 News Processing Pipeline finished successfully.'
        );
      }
    } catch (error) {
      appLogger.error('💥 CRITICAL ERROR in main execution flow:', {
        errorMessage: error.message,
        stack: error.stack,
      });
      runStats.pipelineError =
        runStats.pipelineError || `Main flow error: ${error.message}`;
      process.exitCode = 1;
      logPipelineCompletion(
        startTime,
        '❌ Pipeline terminated due to a critical error.',
        1
      );
      articles =
        Array.isArray(currentArticles) && currentArticles.length > 0
          ? currentArticles
          : allFreshlyAssessedHeadlines;
    } finally {
      appLogger.info('📡 Attempting to send supervisor report email...');
      try {
        let reportableArticles = allFreshlyAssessedHeadlines
          .map((initialArticle) => {
            if (!initialArticle || !initialArticle.link) return null;
            const finalArticleState = Array.isArray(currentArticles)
              ? currentArticles.find(
                  (fa) => fa && fa.link === initialArticle.link
                )
              : null;
            return finalArticleState
              ? { ...initialArticle, ...finalArticleState }
              : initialArticle;
          })
          .filter(Boolean);

        if (
          reportableArticles.length === 0 &&
          Array.isArray(articles) &&
          articles.length > 0
        ) {
          reportableArticles = articles;
        }

        if (pipelineModules && pipelineModules.sendSupervisorReportEmail) {
          await pipelineModules.sendSupervisorReportEmail(
            reportableArticles,
            runStats
          );
        } else {
          appLogger.error('sendSupervisorReportEmail module not loaded.');
          if (process.exitCode === 0) process.exitCode = 1;
        }
      } catch (supervisorEmailError) {
        appLogger.error('💥 Error sending supervisor report email:', {
          supervisorError: supervisorEmailError.message,
          stack: supervisorEmailError.stack,
        });
        if (process.exitCode === 0) process.exitCode = 1;
      }
      appLogger.info('🏁 Pipeline execution sequence ended.');
      const exitCodeToUse = process.exitCode || 0;
      appLogger.info(`Exiting with code: ${exitCodeToUse}.`);
      setTimeout(() => process.exit(exitCodeToUse), 2000);
    }
  }

  await runPipeline();
}

mainApp().catch((err) => {
  appLogger.error('💥 Unrecoverable error at mainApp level:', {
    error: err.message,
    stack: err.stack,
  });
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 2000);
});
