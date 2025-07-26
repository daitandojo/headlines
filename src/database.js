// src/database.js (version 1.0)
import mongoose from 'mongoose';
import { MONGO_URI } from './config/index.js';
import { logger } from './utils/logger.js';

export async function connectDatabase() {
    if (!MONGO_URI) {
        logger.fatal('MONGO_URI is not defined in environment variables. Exiting.');
        process.exit(1);
    }

    try {
        logger.info('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        logger.info('✅ MongoDB connection successful.');
    } catch (error) {
        logger.fatal({ err: error }, '❌ CRITICAL: Failed to establish MongoDB connection.');
        process.exit(1);
    }
}

export async function disconnectDatabase() {
    try {
        await mongoose.disconnect();
        logger.info('MongoDB connection closed.');
    } catch (error) {
        logger.error({ err: error }, 'Error disconnecting from MongoDB.');
    }
}