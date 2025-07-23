// File: headlines_mongo/src/config/database.js
import mongoose from 'mongoose';
import { getLogger } from '@daitanjs/development';
import { MONGO_URI } from './env.js';

const logger = getLogger('headlines-mongo-db');

/**
 * Establishes the MongoDB connection for the application using Mongoose directly.
 * @throws {Error} If MONGO_URI is not set or the connection fails.
 */
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    logger.debug('MongoDB connection is already active.');
    return;
  }

  if (!MONGO_URI) {
    const errMsg = 'MONGO_URI is not configured. Database connection cannot be established.';
    logger.error(errMsg);
    throw new Error(errMsg);
  }

  logger.info('Attempting to connect to MongoDB directly...');
  try {
    // Standard Mongoose connection logic
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });

    logger.info('✅ MongoDB connection successful and active.');

    // Standard Mongoose event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose default connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose default connection disconnected.');
    });

    // Handle application shutdown gracefully
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Mongoose connection disconnected through app termination (SIGINT).');
      process.exit(0);
    });

  } catch (error) {
    logger.error(`❌ CRITICAL: Failed to establish initial MongoDB connection: ${error.message}`);
    // Re-throw to halt application startup
    throw error;
  }
}