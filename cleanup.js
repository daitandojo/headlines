// cleanup-v2.js
// A two-stage script to reclaim database space.
// STAGE 1: Deletes old, irrelevant articles to create operational headroom.
// STAGE 2: Removes the 'articleContent' field from all remaining articles.

import 'dotenv/config';
import mongoose from 'mongoose';
import { MONGO_URI, HEADLINES_RELEVANCE_THRESHOLD } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import Article from './models/Article.js';

async function runCleanup() {
    if (!MONGO_URI) {
        logger.fatal('MONGO_URI is not defined. Please check your .env file.');
        process.exit(1);
    }

    try {
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        logger.info('✅ MongoDB connection successful.');

        // --- STAGE 1: Delete old, irrelevant articles to free up space ---
        logger.info('--- STAGE 1: DELETION ---');
        logger.info("Searching for irrelevant articles older than 14 days to delete...");
        
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // Target articles that are old AND were never fully enriched (i.e., deemed relevant).
        // This is the safest category of documents to delete.
        const deleteResult = await Article.deleteMany({
            createdAt: { $lt: fourteenDaysAgo },
            relevance_article: { $exists: false }
        });

        if (deleteResult.deletedCount > 0) {
            logger.info(`✅ Success! Deleted ${deleteResult.deletedCount} old, irrelevant articles, freeing up space.`);
        } else {
            logger.info('✅ No old, irrelevant articles found to delete. Proceeding to next step.');
        }

        // --- STAGE 2: Remove the 'articleContent' field from all remaining articles ---
        logger.info('--- STAGE 2: UNSET ---');
        logger.info("Searching for articles with an 'articleContent' field to remove it...");

        const updateResult = await Article.updateMany(
            { articleContent: { $exists: true } },
            { $unset: { articleContent: "" } }
        );

        if (updateResult.modifiedCount > 0) {
            logger.info(`✅ Success! Found and removed 'articleContent' from ${updateResult.modifiedCount} articles.`);
        } else {
            logger.info('✅ No articles found with an "articleContent" field. Your database is already clean.');
        }

        logger.info('🎉 All cleanup steps completed successfully!');

    } catch (error) {
        logger.fatal({ err: error }, '❌ CRITICAL: The cleanup script failed to complete. If the error persists, you may need to manually delete some documents or upgrade your database plan.');
    } finally {
        logger.info('Closing MongoDB connection...');
        await mongoose.disconnect();
        logger.info('Connection closed. Cleanup finished.');
    }
}

runCleanup();