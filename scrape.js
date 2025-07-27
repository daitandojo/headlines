// scrape.js
// A utility script to scrape a few headlines and articles from each configured source.
// This is useful for testing, debugging, and adding new newspapers.
// It now directly uses the main application's scraping modules for consistency.
// To run: `node scrape.js` from the project root.

import 'dotenv/config';
import { SITES_CONFIG } from './src/config/sources.js';
import { scrapeAllHeadlines, scrapeArticleContent } from './src/modules/scraper/index.js';
import { truncateString } from './src/utils/helpers.js';

// --- Configuration ---
const HEADLINES_TO_SCRAPE_PER_SITE = 3;

// --- Console Colors for Readability ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    grey: "\x1b[90m",
};
const log = {
    info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
};


/**
 * Main function to orchestrate the test scrape.
 */
async function main() {
    log.info(`🚀 Starting test scrape for ${HEADLINES_TO_SCRAPE_PER_SITE} articles per site...`);

    const allHeadlines = await scrapeAllHeadlines();
    const sites = Object.values(SITES_CONFIG);

    for (const site of sites) {
        console.log(`\n==================== 📰 ${site.name.toUpperCase()} ====================`);

        // FIX: Filter by `h.source` which is guaranteed to match `site.name`.
        const siteHeadlines = allHeadlines
            .filter(h => h.source === site.name)
            .slice(0, HEADLINES_TO_SCRAPE_PER_SITE);

        if (siteHeadlines.length === 0) {
            log.warn(`No headlines found for ${site.name}.`);
            continue;
        }

        log.info(`Found ${siteHeadlines.length} headlines. Fetching full article content...`);

        for (const [index, headline] of siteHeadlines.entries()) {
            console.log(`\n[${index + 1}/${siteHeadlines.length}] ${truncateString(headline.headline, 80)}`);
            console.log(`${colors.grey}  -> ${headline.link}${colors.reset}`); // Always show link
            
            // Use the main application's function to fetch and parse the article
            const articleWithContent = await scrapeArticleContent(headline);

            if (articleWithContent.articleContent?.contents?.length > 0) {
                const contentSnippet = articleWithContent.articleContent.contents.join(' ').trim().replace(/\s\s+/g, ' ').substring(0, 150);
                log.success(`  ✅ SUCCESS: "${contentSnippet}..."`);
            } else {
                const reason = articleWithContent.enrichment_error || 'Selector did not find content (this is expected for live blogs or paywalled articles)';
                log.error(`  ❌ FAILED: ${reason}`);
            }
        }
    }

    log.info('\n✅ Test scrape finished.');
}

// --- Execute Script ---
main().catch(err => {
    console.error(err);
    log.error('The test scrape script encountered a fatal error.');
    process.exit(1);
});