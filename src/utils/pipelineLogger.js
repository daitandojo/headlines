// File: src/utils/pipelineLogger.js
// src/utils/pipelineLogger.js (version 2.1 - Cleaner Report)
import { logger } from './logger.js'
import Article from '../../models/Article.js'
import SynthesizedEvent from '../../models/SynthesizedEvent.js'
import { truncateString } from './helpers.js'
import { disconnectDatabase } from '../database.js'
import {
  ARTICLES_RELEVANCE_THRESHOLD,
  HEADLINES_RELEVANCE_THRESHOLD,
} from '../config/index.js'
// REMOVED: import { USERS } from '../config/users.js';
import Subscriber from '../../models/Subscriber.js' // ADDED
import { COUNTRIES_CONFIG } from '../config/sources.js'

// --- Console Colors for Readability ---
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  grey: '\x1b[90m',
}

/**
 * Truncates long source names for cleaner display in the final report.
 * @param {string} name The full newspaper name.
 * @returns {string} The truncated name.
 */
function truncateSourceName(name) {
  if (!name) return 'N/A'
  const stopChars = ['(', '-']
  let stopIndex = name.length
  for (const char of stopChars) {
    const index = name.indexOf(char)
    if (index !== -1 && index < stopIndex) {
      stopIndex = index
    }
  }
  return name.substring(0, stopIndex).trim()
}

/**
 * Fetches and calculates comprehensive statistics from the database.
 * @returns {Promise<Object>} An object containing various database stats.
 */
async function getDatabaseStats() {
  try {
    const [totalArticles, totalEvents, topRelevantSelectors, allSourceStats] =
      await Promise.all([
        Article.countDocuments(),
        SynthesizedEvent.countDocuments(),
        Article.aggregate([
          { $match: { relevance_article: { $gte: ARTICLES_RELEVANCE_THRESHOLD } } },
          {
            $group: {
              _id: { newspaper: '$newspaper', selector: '$headline_selector' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 15 },
        ]),
        // REVISED: This aggregation now uses relevance_headline for a more accurate 'hit rate'.
        Article.aggregate([
          {
            $group: {
              _id: '$newspaper',
              totalCount: { $sum: 1 },
              relevantCount: {
                $sum: {
                  $cond: [
                    { $gte: ['$relevance_headline', HEADLINES_RELEVANCE_THRESHOLD] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { totalCount: -1 } },
        ]),
      ])

    return {
      totalArticles,
      totalEvents,
      allSourceStats,
      topRelevantSelectors,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch database statistics.')
    return null
  }
}

/**
 * The main function to log the final, comprehensive report for a pipeline run.
 * @param {Object} runStats - The statistics collected during the pipeline run.
 * @param {number} duration - The duration of the pipeline run in seconds.
 */
export async function logFinalReport(runStats, duration) {
  const dbStats = await getDatabaseStats()

  let report = `\n\n${colors.cyan}=============================================================${colors.reset}\n`
  report += `${colors.cyan} 🚀 PIPELINE RUN SUMMARY${colors.reset}\n`
  report += `${colors.cyan}=============================================================${colors.reset}\n\n`
  report += `  ${colors.magenta}Duration:${colors.reset} ${duration} seconds\n\n`

  // --- Current Run Funnel ---
  report += `  ${colors.yellow}--- Funnel (This Run) ---${colors.reset}\n`
  report += `  ${'Headlines Scraped:'.padEnd(25)} ${runStats.headlinesScraped}\n`
  report += `  ${'Fresh/Refreshed Articles:'.padEnd(25)} ${runStats.freshHeadlinesFound}\n`
  report += `  ${'Headlines Assessed:'.padEnd(25)} ${runStats.headlinesAssessed}\n`
  report += `  ${'  > Relevant (>=20):'.padEnd(25)} ${runStats.relevantHeadlines}\n`
  report += `  ${'Articles Enriched:'.padEnd(25)} ${runStats.articlesEnriched}\n`
  report += `  ${'  > Relevant (>=50):'.padEnd(25)} ${runStats.relevantArticles}\n`
  report += `  ${'Events Clustered:'.padEnd(25)} ${runStats.eventsClustered}\n`
  report += `  ${'Events Synthesized:'.padEnd(25)} ${runStats.eventsSynthesized}\n`
  report += `  ${colors.green}${'Events Emailed:'.padEnd(25)} ${runStats.eventsEmailed}${colors.reset}\n`
  if (runStats.errors && runStats.errors.length > 0) {
    report += `  ${colors.red}${'Errors Encountered:'.padEnd(25)} ${runStats.errors.length}${colors.reset}\n`
  }
  report += '\n'

  // --- Top Synthesized Events from this Run ---
  if (
    runStats.synthesizedEventsForReport &&
    runStats.synthesizedEventsForReport.length > 0
  ) {
    report += `  ${colors.yellow}--- Top Synthesized Events (This Run) ---${colors.reset}\n`
    runStats.synthesizedEventsForReport.slice(0, 5).forEach((event) => {
      report += `  ${colors.green}[${String(event.highest_relevance_score).padStart(3)}]${colors.reset} "${truncateString(event.synthesized_headline, 70)}"\n`
    })
    report += '\n'
  }

  // --- Database Statistics ---
  if (dbStats) {
    report += `  ${colors.yellow}--- Database Statistics (Overall) ---${colors.reset}\n`
    report += `  ${'Total Articles:'.padEnd(25)} ${dbStats.totalArticles}\n`
    report += `  ${'Total Synthesized Events:'.padEnd(25)} ${dbStats.totalEvents}\n\n`

    // --- Struggling Sources Report ---
    // MODIFIED: Fetch active subscriber countries from the database
    const activeSubscribers = await Subscriber.find({ isActive: true })
      .select('countries')
      .lean()
    const subscribedCountries = new Set(activeSubscribers.flatMap((s) => s.countries))
    // END MODIFICATION

    const subscribedNewspapers = new Set()
    COUNTRIES_CONFIG.forEach((country) => {
      if (subscribedCountries.has(country.countryName)) {
        country.sites.forEach((site) =>
          subscribedNewspapers.add(site.newspaper || site.name)
        )
      }
    })

    const strugglingSources = new Map()

    // Check 1: Scraped 0 headlines in this run
    runStats.scraperHealth.forEach((health) => {
      if (health.count === 0 && subscribedNewspapers.has(health.source)) {
        if (!strugglingSources.has(health.source))
          strugglingSources.set(health.source, [])
        strugglingSources.get(health.source).push('Scraped 0 headlines this run')
      }
    })

    // Check 2: Failed enrichment in this run
    const enrichmentFailures = new Map()
    runStats.enrichmentOutcomes.forEach((outcome) => {
      if (
        outcome.outcome === 'Dropped' &&
        outcome.assessment_article.includes('Enrichment Failed')
      ) {
        enrichmentFailures.set(
          outcome.newspaper,
          (enrichmentFailures.get(outcome.newspaper) || 0) + 1
        )
      }
    })
    enrichmentFailures.forEach((count, newspaper) => {
      if (subscribedNewspapers.has(newspaper)) {
        if (!strugglingSources.has(newspaper)) strugglingSources.set(newspaper, [])
        strugglingSources
          .get(newspaper)
          .push(`Had ${count} enrichment failure(s) this run`)
      }
    })

    // Check 3: Low relevance hit-rate from database history
    dbStats.allSourceStats.forEach((source) => {
      const relevancePercentage =
        source.totalCount > 0 ? (source.relevantCount / source.totalCount) * 100 : 0
      if (
        source.totalCount > 20 &&
        relevancePercentage < 1 &&
        subscribedNewspapers.has(source._id)
      ) {
        if (!strugglingSources.has(source._id)) strugglingSources.set(source._id, [])
        strugglingSources
          .get(source._id)
          .push(`Low lead rate (<1%): ${source.relevantCount}/${source.totalCount} leads`)
      }
    })

    report += `  ${colors.magenta}Struggling Sources (for subscribed countries):${colors.reset}\n`
    if (strugglingSources.size > 0) {
      strugglingSources.forEach((reasons, source) => {
        const sourceStr = `  - ${truncateSourceName(source)}:`.padEnd(25)
        report += `  ${colors.red}${sourceStr}${reasons.join(', ')}${colors.reset}\n`
      })
    } else {
      report += `  ${colors.green}  No struggling sources identified.${colors.reset}\n`
    }
    report += '\n'

    if (dbStats.topRelevantSelectors && dbStats.topRelevantSelectors.length > 0) {
      report += `  ${colors.magenta}Top Sources for Relevant Articles (Score >= ${ARTICLES_RELEVANCE_THRESHOLD}):${colors.reset}\n`
      dbStats.topRelevantSelectors.forEach((item) => {
        const countStr = `[${item.count}]`.padEnd(6)
        const sourceStr = `${item._id.newspaper}`.padEnd(35)
        // --- FIX: Add fallback for undefined selectors ---
        const selectorStr = item._id.selector || 'JSON-LD / Manual'
        report += `  ${countStr}${sourceStr} > ${colors.grey}${selectorStr}${colors.reset}\n`
      })
      report += '\n'
    }

    const top10Sources = dbStats.allSourceStats.slice(0, 10)
    report += `  ${colors.magenta}Top 10 Article Sources (All Time):${colors.reset}\n`
    top10Sources.forEach((source) => {
      const truncatedName = truncateSourceName(source._id)
      const totalCount = `${source.totalCount} articles`.padEnd(16)
      report += `  ${`  ${truncatedName}:`.padEnd(25)} ${totalCount} (of which ${source.relevantCount} were relevant leads)\n`
    })
  }

  report += `\n${colors.cyan}=============================================================${colors.reset}\n`

  logger.info(report)

  await disconnectDatabase()
}
