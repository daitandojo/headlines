import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { executePipeline } from './app-logic.js';
import './models/Article.js';

// Self-executing async function
(async () => {
    console.log('[RUNNER] Starting pipeline execution script...');
    dotenv.config();

    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        console.error('💥 CRITICAL: MONGO_URI is not defined.');
        process.exit(1);
    }

    try {
        console.log('[RUNNER] Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ [RUNNER] MongoDB connection successful.');

        await executePipeline();

        console.log('[RUNNER] Pipeline finished. Disconnecting from MongoDB.');
        await mongoose.disconnect();
        console.log('✅ [RUNNER] Disconnected from MongoDB. Exiting.');
        process.exit(0);

    } catch (error) {
        console.error('💥💥💥 CRITICAL FAILURE IN PIPELINE RUNNER 💥💥💥', error);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Failed to disconnect from MongoDB during error handling:', disconnectError);
        }
        process.exit(1);
    }
})();