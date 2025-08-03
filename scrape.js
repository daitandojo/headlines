// scrape.js
// A utility script to perform a diagnostic scrape on configured sources.
// This is useful for testing, debugging, and adding new newspapers.
//
// Usage:
//   - Test all sources: `node scrape.js`
//   - Test a single source: `node scrape.js <site_key>`
//     (e.g., `node scrape.js borsen_frontpage`)

import 'dotenv/config';
import pLimit from 'p-limit';
import { SITES_CONFIG } from './src/config/sources.js';
import { scrapeSite, scrapeArticleContent } from './src/modules/scraper/index.js'; // NOTE: scrapeSite must be exported
import { CONCURRENCY_LIMIT } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

// --- Configuration ---
// Temporarily set logger to 'info' to suppress verbose debug messages during the test run.
logger.level = 'info';

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
 * Runs a diagnostic test on a single site configuration.
 * @param {object} site The site configuration from SITES_CONFIG.
 * @returns {Promise<{success: boolean, message: string}>} The result of the test.
 */
async function testSite(site) {
    const statusLine = [`${colors.cyan}${site.name.padEnd(25)}${colors.reset}`];

    try {
        // Step 1: Scrape headlines for this site only.
        const { articles, success: headlineSuccess } = await scrapeSite(site);
        const headlineCount = articles.length;
        
        if (!headlineSuccess || headlineCount === 0) {
            statusLine.push(`${String(headlineCount).padStart(3)} headlines scraped`);
            statusLine.push(`${colors.red}Headline scraping FAILED or returned zero articles.${colors.reset}`);
            return { success: false, message: statusLine.join(' > ') };
        }
        
        statusLine.push(`${colors.green}${String(headlineCount).padStart(3)} headlines scraped${colors.reset}`);

        // Step 2: Test content scraping on the very first article.
        const firstArticle = articles[0];
        const articleWithContent = await scrapeArticleContent(firstArticle);

        const content = articleWithContent.articleContent?.contents?.join('') || '';
        const contentLength = content.length;

        if (contentLength > 150) { // Using 150 as a "good enough" threshold
            statusLine.push(`${colors.green}First article OK (${contentLength} chars)${colors.reset}`);
            return { success: true, message: statusLine.join(' > ') };
        } else {
            const reason = articleWithContent.enrichment_error || `Content too short (< 150 chars)`;
            // MODIFIED: Add the failed URL to the error message for easy debugging.
            const failedLink = `(Link: ${firstArticle.link})`;
            statusLine.push(`${colors.red}Content FAILED: ${reason}${colors.reset} ${colors.grey}${failedLink}${colors.reset}`);
            return { success: false, message: statusLine.join(' > ') };
        }
    } catch (error) {
        statusLine.push(`${colors.red}FATAL SCRIPT ERROR: ${error.message}${colors.reset}`);
        return { success: false, message: statusLine.join(' > ') };
    }
}

/**
 * Main function to orchestrate the diagnostic scrape.
 */
async function main() {
    const siteKey = process.argv[2];
    let sitesToTest = Object.values(SITES_CONFIG);
    const limit = pLimit(CONCURRENCY_LIMIT);

    if (siteKey) {
        if (SITES_CONFIG[siteKey]) {
            sitesToTest = [SITES_CONFIG[siteKey]];
            log(`${colors.yellow}🚀 Starting targeted diagnostic scrape for: ${siteKey}${colors.reset}`);
        } else {
            log(`${colors.red}Error: Site key "${siteKey}" not found in SITES_CONFIG.${colors.reset}`);
            return;
        }
    } else {
        log(`${colors.yellow}🚀 Starting full diagnostic scrape for all ${sitesToTest.length} sources...${colors.reset}`);
    }
    
    log('-----------------------------------------------------------------------------------------');

    const promises = sitesToTest.map(site => limit(() => testSite(site)));
    const results = await Promise.all(promises);

    let successCount = 0;
    let failureCount = 0;

    results.forEach(result => {
        log(result.message);
        if (result.success) {
            successCount++;
        } else {
            failureCount++;
        }
    });

    log('-----------------------------------------------------------------------------------------');
    const summaryColor = failureCount > 0 ? colors.red : colors.green;
    log(`${summaryColor}✅ Diagnostic finished. Passed: ${successCount}, Failed: ${failureCount}${colors.reset}`);
}

// --- Execute Script ---
main().catch(err => {
    console.error(`${colors.red}A critical, unhandled error occurred in the scrape script:${colors.reset}`, err);
    process.exit(1);
});