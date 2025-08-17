// app-logic.js (version 3.0)
import { logger } from './src/utils/logger.js'
import { logFinalReport } from './src/utils/pipelineLogger.js'

// Import pipeline stages
import { runPreFlightChecks } from './src/pipeline/1_preflight.js'
import { runScrapeAndFilter } from './src/pipeline/2_scrapeAndFilter.js'
import { runAssessAndEnrich } from './src/pipeline/3_assessAndEnrich.js'
import { runClusterAndSynthesize } from './src/pipeline/4_clusterAndSynthesize.js'
import { runCommitAndNotify } from './src/pipeline/5_commitAndNotify.js'

export async function runPipeline(isRefreshMode = false) {
  const runStartTime = Date.now()
  logger.info('🚀 STARTING DECOUPLED PIPELINE (v3.0)...')

  // Initialize the main data payload and run statistics object
  const pipelinePayload = {
    isRefreshMode,
    runStats: {
      headlinesScraped: 0,
      scraperHealth: [],
      freshHeadlinesFound: 0,
      headlinesAssessed: 0,
      relevantHeadlines: 0,
      enrichmentOutcomes: [],
      articlesEnriched: 0,
      relevantArticles: 0,
      enrichedBySource: {},
      eventsClustered: 0,
      eventsSynthesized: 0,
      synthesizedEventsForReport: [],
      eventsEmailed: 0,
      errors: [],
    },
    dbConnection: null,
  }

  try {
    // --- STAGE 1: PRE-FLIGHT CHECKS & CONNECTIONS ---
    const preflightResult = await runPreFlightChecks(pipelinePayload)
    if (!preflightResult.success) return // Abort if checks fail

    // --- STAGE 2: SCRAPE & FILTER ---
    const scrapeResult = await runScrapeAndFilter(preflightResult.payload)
    if (!scrapeResult.success) return // Abort if no new articles

    // --- STAGE 3: AI ASSESSMENT & ENRICHMENT ---
    const assessResult = await runAssessAndEnrich(scrapeResult.payload)
    if (!assessResult.success) return // Abort if no relevant articles after enrichment

    // --- STAGE 4: CLUSTERING & SYNTHESIS ---
    const synthesizeResult = await runClusterAndSynthesize(assessResult.payload)
    // This stage is not critical; if it fails, we still want to save the articles.

    // --- STAGE 5: COMMIT RESULTS & SEND NOTIFICATIONS ---
    await runCommitAndNotify(synthesizeResult.payload)
  } catch (error) {
    logger.fatal(
      { err: error },
      'A critical, unhandled error occurred in the main pipeline orchestrator.'
    )
    pipelinePayload.runStats.errors.push(`ORCHESTRATOR_FATAL: ${error.message}`)
    // Attempt to send a supervisor report even on critical failure
    await runCommitAndNotify(pipelinePayload)
  } finally {
    const runEndTime = Date.now()
    const duration = ((runEndTime - runStartTime) / 1000).toFixed(2)
    await logFinalReport(pipelinePayload.runStats, duration)
  }
}
