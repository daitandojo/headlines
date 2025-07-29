// scripts/showHighRelevance.js
// A script to connect to the database and list all articles with a high relevance score.

import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { logger } from '../src/utils/logger.js';

/**
 * Main function to fetch and display high-relevance articles.
 */
async function showHighRelevanceArticles() {
    logger.info('Connecting to the database to find high-relevance articles...');
    await connectDatabase();

    try {
        // Find articles where either the article score OR the headline score is > 40.
        const articles = await Article.find({
            $or: [
                { relevance_article: { $gt: 40 } },
                { relevance_headline: { $gt: 40 } }
            ]
        })
        .sort({ relevance_article: -1, relevance_headline: -1 }) // Sort by highest score first
        .limit(200) // Limit to a reasonable number of results
        .lean(); // Use .lean() for faster, read-only queries

        if (articles.length === 0) {
            logger.warn('No articles found with a relevance score greater than 40.');
            return;
        }

        logger.info(`✅ Found ${articles.length} articles with a relevance score > 40. Displaying now:\n`);

        console.log('--- HIGH RELEVANCE ARTICLES ---');
        articles.forEach(article => {
            // Prefer the article score if it exists, otherwise use the headline score.
            const primaryScore = article.relevance_article ?? article.relevance_headline;
            const scoreDisplay = String(primaryScore).padStart(3);

            console.log(`[${scoreDisplay}] "${article.headline}" (${article.newspaper})`);
            console.log(`  -> Scores (Article/Headline): ${article.relevance_article ?? 'N/A'} / ${article.relevance_headline}`);
            console.log(`  -> Link: ${article.link}`);
            if (article.assessment_article) {
                console.log(`  -> AI Reason: ${article.assessment_article}`);
            } else {
                console.log(`  -> AI Reason: ${article.assessment_headline}`);
            }
            console.log('---------------------------------');
        });

    } catch (error) {
        logger.error({ err: error }, 'An error occurred while fetching articles.');
    } finally {
        await disconnectDatabase();
    }
}

// --- Execute Script ---
showHighRelevanceArticles().catch(err => {
    logger.fatal({ err }, 'The script encountered a fatal error.');
    process.exit(1);
});