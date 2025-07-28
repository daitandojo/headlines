// scripts/embedPastArticles.js
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { generateEmbedding } from '../src/utils/vectorUtils.js';
import { logger } from '../src/utils/logger.js';

async function embedPastArticles() {
    logger.info('Starting backfill process for article embeddings...');
    await connectDatabase();

    const articlesToProcess = await Article.find({ embedding: { $exists: false } }).lean();

    if (articlesToProcess.length === 0) {
        logger.info('No articles found without embeddings. Process complete.');
        await disconnectDatabase();
        return;
    }

    logger.info(`Found ${articlesToProcess.length} articles to embed. This may take some time...`);
    
    let processedCount = 0;
    const operations = [];

    for (const article of articlesToProcess) {
        try {
            const textToEmbed = `${article.headline}\n${article.assessment_headline || ''}`;
            const embedding = await generateEmbedding(textToEmbed);

            operations.push({
                updateOne: {
                    filter: { _id: article._id },
                    update: { $set: { embedding: embedding } }
                }
            });
            
            processedCount++;
            logger.info(`(${processedCount}/${articlesToProcess.length}) Embedded: "${article.headline}"`);

        } catch (error) {
            logger.error({ err: error, articleId: article._id }, `Failed to process article.`);
        }
    }

    if (operations.length > 0) {
        logger.info(`Bulk writing ${operations.length} updates to the database...`);
        await Article.bulkWrite(operations, { ordered: false });
        logger.info('✅ Bulk write complete.');
    }

    logger.info('Embedding backfill process finished.');
    await disconnectDatabase();
}

embedPastArticles().catch(err => {
    logger.fatal({ err }, 'An unhandled error occurred during the embedding backfill process.');
    process.exit(1);
});