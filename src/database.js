// src/database.js (version 1.0)
import mongoose from 'mongoose';
import { MONGO_URI } from './config/index.js';
import { logger } from './utils/logger.js';

export async function connectDatabase() {
    if (!MONGO_URI) {
        logger.fatal('MONGO_URI is not defined in environment variables. Exiting.');
        process.exit(1);
    }

    // If we are already connected or connecting, don't try again.
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        logger.info('MongoDB connection is already active.');
        return true;
    }

    try {
        logger.info('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        
        if (mongoose.connection.readyState === 1) {
            logger.info('✅ MongoDB connection successful.');
            return true;
        } else {
            logger.fatal('MongoDB connection attempt finished but readyState is not "connected".');
            return false;
        }

    } catch (error) {
        logger.fatal({ err: error }, '❌ CRITICAL: Failed to establish MongoDB connection.');
        // In case of an error, Mongoose might handle the process exit.
        // We ensure it exits if it doesn't.
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