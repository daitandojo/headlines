// src/pipeline/2_scrapeAndFilter.js (version 1.1 - Add Fresh Headline Logging)
import { logger } from '../utils/logger.js';
import { scrapeAllHeadlines } from '../modules/scraper/index.js';
import { filterFreshArticles } from '../modules/dataStore/index.js';
import mongoose from 'mongoose';
import { generateEmbedding } from '../utils/vectorUtils.js';
import { truncateString } from '../utils/helpers.js';

/**
 * Stage 2: Scrapes all configured sources for headlines and filters out existing ones.
 * @param {object} pipelinePayload - The main pipeline payload object.
 * @returns {Promise<{success: boolean, payload: object}>}
 */
export async function runScrapeAndFilter(pipelinePayload) {
    logger.info('--- STAGE 2: SCRAPE & FILTER ---');
    
    const { allArticles: scrapedHeadlines, scraperHealth } = await scrapeAllHeadlines();
    pipelinePayload.runStats.scraperHealth = scraperHealth;
    pipelinePayload.runStats.headlinesScraped = scrapedHeadlines.length;

    const articlesToProcess = await filterFreshArticles(scrapedHeadlines, pipelinePayload.isRefreshMode);
    pipelinePayload.runStats.freshHeadlinesFound = articlesToProcess.length;

    if (articlesToProcess.length === 0) {
        logger.info('No new or refreshed articles to process. Ending run.');
        return { success: false, payload: pipelinePayload };
    }
    
    // --- NEW: Log a sample of fresh headlines for quality control ---
    const freshHeadlinesSample = articlesToProcess.slice(0, 5).map(a => 
        `  - "${truncateString(a.headline, 70)}" (${a.newspaper})`
    ).join('\n');
    logger.info(`Found ${articlesToProcess.length} fresh articles to process. Sample:\n${freshHeadlinesSample}`);
    // --- END NEW LOGGING ---

    // Prepare articles for the next stage by creating in-memory representations
    const articlesForPipeline = [];
    for (const article of articlesToProcess) {
        const embedding = await generateEmbedding(article.headline);
        articlesForPipeline.push({
            ...article,
            _id: new mongoose.Types.ObjectId(),
            embedding,
            relevance_headline: 0,
            assessment_headline: 'Awaiting assessment',
        });
    }

    pipelinePayload.articlesForPipeline = articlesForPipeline;
    pipelinePayload.assessedCandidates = articlesForPipeline; // Pre-populate for Stage 5

    return { success: true, payload: pipelinePayload };
}