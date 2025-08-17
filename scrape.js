// scrape.js (version 2.2)
// A comprehensive health-check script for the sources.js configuration.
// It tests headline and content selectors for each source and saves debug files.
//
// Usage:
//   - Test all sources: `node scrape.js`
//   - Test a single source: `node scrape.js <site_key>`
//     (e.g., `node scrape.js kkr`)

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import { COUNTRIES_CONFIG } from './src/config/sources.js';
import { scrapeSite, scrapeArticleContent } from './src/modules/scraper/index.js';
import { CONCURRENCY_LIMIT } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

// --- Configuration ---
logger.level = 'info';
const DEBUG_DIR = path.join(process.cwd(), 'debug');
const MIN_HEADLINES = 1;
const MIN_CONTENT_CHARS = 150;

// --- Console Colors for Readability ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    grey: "\x1b[90m",
};

const log = (msg) => console.log(msg);

/**
 * Runs a diagnostic health check on a single site configuration.
 * @param {object} site The site configuration, augmented with countryName.
 * @returns {Promise<{success: boolean, message: string}>} The result of the test.
 */
async function testSite(site) {
    const statusLine = [`${colors.cyan}[${site.countryName}] ${site.name.padEnd(35)}${colors.reset}`];
    
    // --- STAGE 1: HEADLINE SCRAPING ---
    const { articles, success: headlineSuccess } = await scrapeSite(site);
    
    if (!headlineSuccess || articles.length < MIN_HEADLINES) {
        const selector = site.useJsonLd ? 'JSON-LD' : site.selector;
        statusLine.push(`${colors.red}FAILED (Headlines: ${articles.length} found with selector '${selector}')${colors.reset}`);
        return { success: false, message: statusLine.join(' > ') };
    }
    statusLine.push(`${colors.green}HEADLINES OK (${articles.length})${colors.reset}`);

    // --- STAGE 2: ARTICLE CONTENT SCRAPING ---
    const firstArticle = articles[0];
    const articleWithContent = await scrapeArticleContent(firstArticle);
    const content = articleWithContent.articleContent?.contents?.join('') || '';

    if (content.length < MIN_CONTENT_CHARS) {
        const reason = articleWithContent.enrichment_error || `Content too short (${content.length} chars)`;
        statusLine.push(`${colors.red}FAILED (Content: ${reason})${colors.reset}`);
        return { success: false, message: statusLine.join(' > ') };
    }

    statusLine.push(`${colors.green}CONTENT OK (${content.length} chars)${colors.reset}`);
    return { success: true, message: statusLine.join(' > ') };
}

/**
 * Main function to orchestrate the health check.
 */
async function main() {
    await fs.rm(DEBUG_DIR, { recursive: true, force: true });
    log(`${colors.grey}Cleared debug directory.${colors.reset}`);

    const siteKey = process.argv[2];
    
    const allSites = COUNTRIES_CONFIG.flatMap(country => 
        country.sites.map(site => ({ ...site, countryName: country.countryName }))
    );
    let sitesToTest = allSites;

    const limit = pLimit(CONCURRENCY_LIMIT);

    if (siteKey) {
        const targetSite = allSites.find(site => site.key === siteKey);
        if (targetSite) {
            sitesToTest = [targetSite];
            log(`${colors.yellow}🚀 Starting targeted health check for: ${siteKey}${colors.reset}`);
        } else {
            log(`${colors.red}Error: Site key "${siteKey}" not found in sources.js.${colors.reset}`);
            return;
        }
    } else {
        log(`${colors.yellow}🚀 Starting full health check for all ${sitesToTest.length} sources...${colors.reset}`);
    }
    
    log('-------------------------------------------------------------------------------------------------------------');

    let successCount = 0;
    let failureCount = 0;

    const promises = sitesToTest.map(site => limit(async () => {
        const result = await testSite(site);
        log(result.message);
        if (result.success) {
            successCount++;
        } else {
            failureCount++;
        }
    }));

    await Promise.all(promises);

    log('-------------------------------------------------------------------------------------------------------------');
    const summaryColor = failureCount > 0 ? colors.red : colors.green;
    log(`${summaryColor}✅ Health check finished. Passed: ${successCount}, Failed: ${failureCount}${colors.reset}`);
}

// --- Execute Script ---
main().catch(err => {
    console.error(`${colors.red}A critical, unhandled error occurred in the scrape script:${colors.reset}`, err);
    process.exit(1);
});