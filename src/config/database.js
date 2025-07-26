import { MONGO_URI } from [LOCAL .env FILE];

/**
 * Establishes the MongoDB connection for the headlines_mongo application
 * using the centralized utility from @daitanjs/data.
 * @throws {Error} If MONGO_URI is not set or the connection fails.
 */
export async function connectDatabase() {
  if (!MONGO_URI) {
    const errMsg =
      'MONGO_URI is not configured for headlines_mongo. Database connection cannot be established.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  logger.info('Attempting to connect to MongoDB via @daitanjs/data library...');
  try {
    // Call the library function, passing the app's specific URI and logger
    await connectToMongoose(MONGO_URI, {}, { loggerInstance: logger });

    if (getMongooseDefaultReadyState() === 1) {
      // 1 means connected
      logger.info(
        '✅ MongoDB connection successful and active (via @daitanjs/data).'
      );
    } else {
      // This state should ideally be an error thrown by connectToMongoose if it fails after retries
      const errMsg =
        'MongoDB connection attempt sequence finished, but connection is not in ready state (1).';
      logger.error(errMsg, { readyState: getMongooseDefaultReadyState() });
      throw new Error(errMsg);
    }
  } catch (error) {
    logger.error(
      `❌ CRITICAL: Failed to establish MongoDB connection via @daitanjs/data: ${error.message}`
    );
    // It's important to re-throw so the application (app.js) knows startup failed.
    throw error;
  }
}
