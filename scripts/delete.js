// scripts/delete.js
import { getLogger, loadEnvironmentFiles } from '@daitanjs/development';
import {
  connectToMongoose,
  disconnectFromMongoose,
  getMongooseDefaultReadyState,
  getMongooseInstance,
} from '@daitanjs/data';
import readline from 'readline';

// Initialize logger
const scriptLogger = getLogger('deleteAllArticlesScript');

// Use the library's Mongoose instance to interact with models
const mongooseInstanceFromLib = getMongooseInstance();

// --- Environment and DB Connection ---
async function initializeAndConnect() {
  scriptLogger.info('Initializing script environment...');
  loadEnvironmentFiles({ loggerInstance: scriptLogger, override: true });

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set or loaded.');
  }

  if (getMongooseDefaultReadyState() !== 1) {
    scriptLogger.info(`Attempting to connect to MongoDB via @daitanjs/data...`);
    await connectToMongoose(MONGO_URI, {}, { loggerInstance: scriptLogger });
  } else {
    scriptLogger.debug('Already connected to MongoDB.');
  }
}

async function disconnectDB() {
  if (getMongooseDefaultReadyState() !== 0) {
    await disconnectFromMongoose({ loggerInstance: scriptLogger });
  }
}

function askForConfirmation(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function deleteAllArticleData() {
  let exitCode = 0;
  try {
    await initializeAndConnect();

    // Dynamically import the model after connection is established
    const Article = (await import('../models/Article.js')).default;
    const dbName = mongooseInstanceFromLib.connection.name;
    const collectionName = Article.collection.name;

    scriptLogger.info(
      `Model: ${Article.modelName}, Collection: ${collectionName}, DB: ${dbName}`
    );

    scriptLogger.warn(
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
    );
    scriptLogger.warn(
      `You are about to DELETE ALL ENTRIES from the "${collectionName}" collection in the database "${dbName}".`
    );
    scriptLogger.warn('This operation is IRREVERSIBLE.');
    scriptLogger.warn(
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'
    );

    const confirmation = await askForConfirmation(
      `Type 'yes' to confirm deletion from "${collectionName}": `
    );

    if (confirmation.toLowerCase() !== 'yes') {
      scriptLogger.info('Operation cancelled by the user.');
      return;
    }

    scriptLogger.info('User confirmed. Proceeding with deletion...');
    const initialCount = await Article.countDocuments({});
    if (initialCount === 0) {
      scriptLogger.info(`Collection "${collectionName}" is already empty.`);
    } else {
      scriptLogger.info(`Attempting to delete ${initialCount} documents...`);
      const result = await Article.deleteMany({});
      scriptLogger.info(
        `Deletion acknowledged: ${result.acknowledged}, Count: ${result.deletedCount}`
      );
      if (result.acknowledged && result.deletedCount === initialCount) {
        scriptLogger.info('✅ All documents successfully deleted.');
      } else {
        scriptLogger.warn(
          '⚠️ Deletion might be incomplete or failed. Please verify in the database.'
        );
        exitCode = 1;
      }
    }
  } catch (error) {
    scriptLogger.error('An error occurred during the deletion script:', error);
    exitCode = 1;
  } finally {
    await disconnectDB();
    scriptLogger.info('Deletion script finished.');
    setTimeout(() => process.exit(exitCode), 500);
  }
}

deleteAllArticleData();