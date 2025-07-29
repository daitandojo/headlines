// scripts/showHighRelevance.js
// A script to connect to the database and list all articles with a high relevance score.
// Usage:
//   node scripts/showHighRelevance.js       (uses default threshold of 10)
//   node scripts/showHighRelevance.js 50    (uses a threshold of 50)

import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { logger } from '../src/utils/logger.js';

// --- Console Colors for Readability ---
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    grey: "\x1b[90m",
};

/**
 * Main function to fetch and display high-relevance articles.
 * @param {number} threshold The minimum relevance score to display.
 */
async function showHighRelevanceArticles(threshold) {
    logger.info(`Connecting to the database to find articles with relevance > ${threshold}...`);
    await connectDatabase();

    try {
        // Find articles where either the article score OR the headline score is > threshold.
        const articles = await Article.find({
            $or: [
                { relevance_article: { $gt: threshold } },
                { relevance_headline: { $gt: threshold } }
            ]
        })
        .sort({ relevance_article: -1, relevance_headline: -1 }) // Sort by highest score first
        .limit(200) // Limit to a reasonable number of results
        .lean(); // Use .lean() for faster, read-only queries

        if (articles.length === 0) {
            logger.warn(`No articles found with a relevance score greater than ${threshold}.`);
            return;
        }

        logger.info(`✅ Found ${articles.length} articles with a relevance score > ${threshold}. Displaying now:\n`);

        console.log(`${colors.cyan}--- HIGH RELEVANCE ARTICLES (Threshold: ${threshold}) ---${colors.reset}`);
        articles.forEach(article => {
            const primaryScore = article.relevance_article ?? article.relevance_headline;
            const scoreDisplay = String(primaryScore).padStart(3);
            const scoreColor = primaryScore >= 80 ? colors.green : primaryScore >= 50 ? colors.yellow : colors.reset;
            
            console.log(`${scoreColor}[${scoreDisplay}]${colors.reset} "${article.headline}" (${article.newspaper})`);
            console.log(`  -> ${colors.grey}Scores (Article/Headline): ${article.relevance_article ?? 'N/A'} / ${article.relevance_headline}${colors.reset}`);
            console.log(`  -> ${colors.grey}Link: ${article.link}${colors.reset}`);
            
            const reason = article.assessment_article || article.assessment_headline;
            if (reason) {
                console.log(`  -> ${colors.grey}AI Reason: ${reason}${colors.reset}`);
            }
            console.log('---------------------------------');
        });

    } catch (error) {
        logger.error({ err: error }, 'An error occurred while fetching articles.');
    } finally {
        await disconnectDatabase();
    }
}

// --- Parse Command-Line Argument and Execute Script ---

// process.argv contains command-line arguments:
// [0] is the node executable path
// [1] is the script file path
// [2] is the first user-provided argument
const thresholdArg = process.argv[2];
let threshold = 10; // Default threshold

if (thresholdArg) {
    const parsedThreshold = parseInt(thresholdArg, 10);
    if (!isNaN(parsedThreshold) && parsedThreshold >= 0) {
        threshold = parsedThreshold;
    } else {
        logger.error(`Invalid threshold provided: "${thresholdArg}". Please provide a non-negative number.`);
        process.exit(1);
    }
}

showHighRelevanceArticles(threshold).catch(err => {
    logger.fatal({ err }, 'The script encountered a fatal error.');
    process.exit(1);
});