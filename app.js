// app.js

// --- CRITICAL: Set environment based on command-line args BEFORE any other imports ---
// This ensures that all modules, especially the config, see the correct environment state
// from the very beginning of the application lifecycle.
const isRefreshMode = process.argv.includes('--refresh');
if (isRefreshMode) {
    process.env.REFRESH_MODE = 'true';
}

import 'dotenv/config'; // Load environment variables from .env file
import { logger } from './src/utils/logger.js';
import { runPipeline } from './app-logic.js';

// Now that the logger has been initialized (with the correct mode), we can safely log the warning.
if (isRefreshMode) {
    logger.warn('🚀 REFRESH MODE ACTIVATED: Previously processed articles from this scrape will be treated as fresh.');
}

async function start() {
    try {
        // Pass the determined mode directly to the pipeline.
        await runPipeline(isRefreshMode);
        // The process will exit naturally after the pipeline completes.
    } catch (error) {
        logger.fatal({ err: error }, 'A top-level, unhandled exception occurred in the application. The pipeline did not complete.');
        // Exit with a failure code to signal an issue to the scheduler (e.g., Fly.io).
        process.exit(1);
    }
}

start();