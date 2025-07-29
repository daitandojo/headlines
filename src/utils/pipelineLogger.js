// src/utils/pipelineLogger.js
import { logger } from './logger.js';
import Article from '../../models/Article.js';
import SynthesizedEvent from '../../models/SynthesizedEvent.js';
import { truncateString } from './helpers.js';
import { disconnectDatabase } from '../database.js';

// --- Console Colors for Readability ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    grey: "\x1b[90m",
};

/**
 * Fetches and calculates comprehensive statistics from the database.
 * @returns {Promise<Object>} An object containing various database stats.
 */
async function getDatabaseStats() {
    try {
        const [totalArticles, totalEvents, relevanceAggregation, sourceAggregation] = await Promise.all([
            Article.countDocuments(),
            SynthesizedEvent.countDocuments(),
            Article.aggregate([
                {
                    $bucket: {
                        groupBy: "$relevance_article",
                        boundaries: [0, 30, 50, 80, 101],
                        default: "Other",
                        output: { count: { $sum: 1 } }
                    }
                }
            ]),
            Article.aggregate([
                { $group: { _id: '$newspaper', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        return {
            totalArticles,
            totalEvents,
            relevanceBuckets: relevanceAggregation,
            topSources: sourceAggregation
        };
    } catch (error) {
        logger.error({ err: error }, "Failed to fetch database statistics.");
        return null;
    }
}

/**
 * The main function to log the final, comprehensive report for a pipeline run.
 * @param {Object} runStats - The statistics collected during the pipeline run.
 * @param {number} duration - The duration of the pipeline run in seconds.
 */
export async function logFinalReport(runStats, duration) {
    const dbStats = await getDatabaseStats();

    let report = `\n\n${colors.cyan}=============================================================${colors.reset}\n`;
    report += `${colors.cyan} 🚀 PIPELINE RUN SUMMARY${colors.reset}\n`;
    report += `${colors.cyan}=============================================================${colors.reset}\n\n`;
    report += `  ${colors.magenta}Duration:${colors.reset} ${duration} seconds\n\n`;

    // --- Current Run Funnel ---
    report += `  ${colors.yellow}--- Funnel (This Run) ---${colors.reset}\n`;
    report += `  ${'Headlines Scraped:'.padEnd(25)} ${runStats.headlinesScraped}\n`;
    report += `  ${'Fresh/Refreshed Articles:'.padEnd(25)} ${runStats.freshHeadlinesFound}\n`;
    report += `  ${'Headlines Assessed:'.padEnd(25)} ${runStats.headlinesAssessed}\n`;
    report += `  ${'  > Relevant (>=20):'.padEnd(25)} ${runStats.relevantHeadlines}\n`;
    report += `  ${'Articles Enriched:'.padEnd(25)} ${runStats.articlesEnriched}\n`;
    report += `  ${'  > Relevant (>=50):'.padEnd(25)} ${runStats.relevantArticles}\n`;
    report += `  ${'Events Clustered:'.padEnd(25)} ${runStats.eventsClustered}\n`;
    report += `  ${'Events Synthesized:'.padEnd(25)} ${runStats.eventsSynthesized}\n`;
    report += `  ${colors.green}${'Events Emailed:'.padEnd(25)} ${runStats.eventsEmailed}${colors.reset}\n`;
    if (runStats.errors && runStats.errors.length > 0) {
        report += `  ${colors.red}${'Errors Encountered:'.padEnd(25)} ${runStats.errors.length}${colors.reset}\n`;
    }
    report += '\n';

    // --- Top Synthesized Events from this Run ---
    if (runStats.synthesizedEventsForReport && runStats.synthesizedEventsForReport.length > 0) {
        report += `  ${colors.yellow}--- Top Synthesized Events (This Run) ---${colors.reset}\n`;
        runStats.synthesizedEventsForReport.slice(0, 5).forEach(event => {
            report += `  ${colors.green}[${String(event.highest_relevance_score).padStart(3)}]${colors.reset} "${truncateString(event.synthesized_headline, 70)}"\n`;
        });
        report += '\n';
    }

    // --- Database Statistics ---
    if (dbStats) {
        report += `  ${colors.yellow}--- Database Statistics (Overall) ---${colors.reset}\n`;
        report += `  ${'Total Articles:'.padEnd(25)} ${dbStats.totalArticles}\n`;
        report += `  ${'Total Synthesized Events:'.padEnd(25)} ${dbStats.totalEvents}\n\n`;
        
        report += `  ${colors.magenta}Article Relevance Breakdown:${colors.reset}\n`;
        dbStats.relevanceBuckets.forEach(bucket => {
            // FIX: Handle potential undefined boundaries
            const rangeEnd = bucket.boundaries && bucket.boundaries.length > 1 ? bucket.boundaries[1] - 1 : '...';
            const range = bucket._id === 'Other' ? 'N/A' : `${bucket._id} - ${rangeEnd}`;
            report += `  ${`  Score ${range}:`.padEnd(25)} ${bucket.count} articles\n`;
        });
        report += '\n';

        report += `  ${colors.magenta}Top 10 Article Sources:${colors.reset}\n`;
        dbStats.topSources.forEach(source => {
            report += `  ${`  ${source._id}:`.padEnd(25)} ${source.count} articles\n`;
        });
    }

    report += `\n${colors.cyan}=============================================================${colors.reset}\n`;

    // --- FIX: Only log the formatted string, not the raw objects ---
    logger.info(report);

    await disconnectDatabase();
}