// scripts/migrateToMongo.js
import { readFile, rm } from 'fs/promises';
import {
  getLogger,
  loadEnvironmentFiles,
  getEnvVariable,
} from '@daitanjs/development';
import { connectToMongoose, disconnectFromMongoose } from '@daitanjs/data';
import path from 'path';

const logger = getLogger('migration-script');

async function readJsonFile(filePath) {
  try {
    const data = await readFile(filePath, 'utf8');
    return data
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn(`File not found: ${filePath}`);
      return [];
    }
    throw error;
  }
}

async function migrateData() {
  let exitCode = 0;
  try {
    logger.info('🚀 Starting migration to MongoDB...');

    // 1. Load environment variables using the DaitanJS utility
    loadEnvironmentFiles({ loggerInstance: logger, override: true });
    const MONGO_URI = getEnvVariable('MONGO_URI', null, true);

    // 2. Connect to MongoDB using the DaitanJS utility
    await connectToMongoose(MONGO_URI, {}, { loggerInstance: logger });

    // 3. Import the Mongoose model (it will use the established connection)
    const Article = (await import('../models/Article.js')).default;
    const collectionName = Article.collection.name;

    // 4. Read the legacy JSON file
    const headlinesPath = path.resolve('./output/headlines.json');
    logger.info(`Reading headlines from ${headlinesPath}`);
    const headlines = await readJsonFile(headlinesPath);

    if (headlines.length === 0) {
      logger.warn('No headlines found to migrate.');
      return;
    }

    logger.info(`Found ${headlines.length} headlines to migrate.`);

    // 5. Insert headlines into MongoDB, checking for existence
    let insertedCount = 0;
    for (const headline of headlines) {
      try {
        const exists = await Article.exists({
          $or: [{ headline: headline.headline }, { link: headline.link }],
        });

        if (!exists) {
          await Article.create(headline);
          insertedCount++;
        }
      } catch (error) {
        logger.error(`Error inserting headline: ${error.message}`, {
          headline: headline.headline,
        });
      }
    }

    logger.info(
      `Successfully migrated ${insertedCount} new headlines to MongoDB collection "${collectionName}".`
    );

    // 6. Clean up legacy file
    if (insertedCount > 0) {
      logger.info('Cleaning up legacy headlines.json file...');
      await rm(headlinesPath, { force: true });
      logger.info('Cleanup complete.');
    }

    logger.info('✅ Migration completed successfully');
  } catch (error) {
    logger.error('💥 Migration failed:', error);
    exitCode = 1;
  } finally {
    await disconnectFromMongoose({ loggerInstance: logger });
    process.exit(exitCode);
  }
}

migrateData();
