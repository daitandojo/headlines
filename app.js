// app.js
import 'dotenv/config'; // Load environment variables at the very beginning
import { logger } from './src/utils/logger.js';
import { runPipeline } from './app-logic.js';

// NEW: Check for a '--refresh' command-line argument to enable re-processing.
const isRefreshMode = process.argv.includes('--refresh');
if (isRefreshMode) {
    process.env.REFRESH_MODE = 'true';
    logger.warn('🚀 REFRESH MODE ACTIVATED: Previously processed articles from this scrape will be treated as fresh.');
}

async function start() {
    try {
        await runPipeline();
        // The process will exit naturally after the pipeline completes.
    } catch (error) {
        logger.fatal({ err: error }, 'A top-level, unhandled exception occurred in the application. The pipeline did not complete.');
        // Exit with a failure code to signal an issue to the scheduler (e.g., Fly.io).
        process.exit(1);
    }
}

start();