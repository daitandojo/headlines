// scripts/seedFacts.js
// A script to read a JSON file of factual data and upload it to the 'articles' collection,
// treating each fact as a highly relevant, pre-assessed article.
//
// Usage:
//   node scripts/seedFacts.js <path_to_json_file>
// Example:
//   node scripts/seedFacts.js ./data/facts.json

import 'dotenv/config';
import fs from 'fs/promises';
import { connectDatabase, disconnectDatabase } from '../src/database.js';
import Article from '../models/Article.js';
import { generateEmbedding } from '../src/utils/vectorUtils.js';
import { logger } from '../src/utils/logger.js';

/**
 * Main function to read, process, and upload facts from a given file path.
 * @param {string} filePath The path to the JSON file containing the facts.
 */
async function seedFacts(filePath) {
    logger.info(`Starting fact seeding process from ${filePath}...`);
    await connectDatabase();

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const facts = JSON.parse(data);

        if (!Array.isArray(facts) || facts.length === 0) {
            logger.warn('No facts found in the JSON file. Exiting.');
            return;
        }

        logger.info(`Found ${facts.length} facts to process and embed.`);
        const operations = [];

        for (const fact of facts) {
            // 1. Create a cohesive text block for embedding
            const textToEmbed = `${fact.headline}\n${(fact.articleContent?.contents || []).join(' ')}`;
            
            // 2. Generate the vector embedding
            const embedding = await generateEmbedding(textToEmbed);
            
            // 3. Prepare the final payload for the database
            const articlePayload = {
                ...fact,
                embedding: embedding,
                emailed: true, // Mark as already "processed" to prevent emailing
                createdAt: new Date(), // Set creation date to now
            };
            
            // 4. Create an upsert operation to avoid duplicates on re-runs
            operations.push({
                updateOne: {
                    filter: { link: fact.link }, // Use the unique link as the key
                    update: { $set: articlePayload },
                    upsert: true
                }
            });
            logger.info(`Prepared and embedded: "${fact.headline}"`);
        }

        if (operations.length > 0) {
            logger.info(`Bulk writing ${operations.length} facts to the database...`);
            const result = await Article.bulkWrite(operations, { ordered: false });
            logger.info(`✅ Fact seeding complete. Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}.`);
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error(`Error: The file was not found at the specified path: ${filePath}`);
        } else if (error instanceof SyntaxError) {
            logger.error(`Error: The file at ${filePath} contains invalid JSON. Please check the file for syntax errors.`);
        } else {
            logger.error({ err: error }, 'An unexpected error occurred during the fact seeding process.');
        }
    } finally {
        await disconnectDatabase();
    }
}

// --- Parse Command-Line Argument and Execute Script ---

// process.argv[2] is the first user-provided command-line argument.
const factsFilePath = process.argv[2];

if (!factsFilePath) {
    logger.error('Error: Missing required file path argument.');
    logger.error('Usage: node scripts/seedFacts.js <path_to_json_file>');
    process.exit(1);
}

seedFacts(factsFilePath).catch(err => {
    logger.fatal({ err }, 'The fact seeding script encountered a fatal error.');
    process.exit(1);
});