// File: app.js (Final Version - Instrumented)
import express from 'express';
import { getLogger } from '@daitanjs/development';
import { connectDatabase } from './src/config/database.js';
import { setupApp } from './src/setup/setupApp.js';
import { validateAllSourceConfigs } from './src/utils/configValidator.js';
import { executePipeline } from './app-logic.js';

const bootLogger = getLogger('server-boot');
console.log('app.js module execution started.');

process.setMaxListeners(30);
process.on('unhandledRejection', (reason, promise) => {
  bootLogger.error('💥 FATAL: Unhandled Rejection at:', { promise, reason });
  setTimeout(() => process.exit(1), 1000);
});
process.on('uncaughtException', (error) => {
  bootLogger.error('💥 FATAL: Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});
console.log('Global handlers are active.');

async function startServer() {
  console.log('startServer() entered.');
  try {
    console.log('Step 1: Validating source configurations...');
    validateAllSourceConfigs();
    console.log('Step 1: Source configurations valid.');

    console.log('Step 2: Performing application setup checks...');
    await setupApp();
    console.log('Step 2: Application setup checks complete.');

    console.log('Step 3: Connecting to database...');
    await connectDatabase();
    console.log('✅ Step 3: Database connection successful.');

    const app = express();
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
    let isPipelineRunning = false;

    console.log('Step 4: Configuring Express server routes...');
    app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning }));
    app.post('/run-pipeline', (req, res) => { // <-- REMOVED ASYNC HERE
      const serverLogger = getLogger('headlines-server');
      serverLogger.info('[API] /run-pipeline endpoint hit.');

      if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (isPipelineRunning) {
        return res.status(429).json({ message: 'Pipeline already running.' });
      }

      // 1. Immediately send the success response.
      res.status(202).json({ message: 'Pipeline run accepted.' });
      
      // 2. Schedule the heavy work to run AFTER the response has been sent.
      setTimeout(async () => {
        console.log('[DIAGNOSTIC] setTimeout callback initiated. Preparing to execute pipeline.');
        isPipelineRunning = true;
        try {
          console.log('[DIAGNOSTIC] PRE-AWAIT executePipeline()');
          await executePipeline();
          console.log('[DIAGNOSTIC] POST-AWAIT executePipeline() - Execution finished.');
        } catch (error) {
          console.error('[DIAGNOSTIC] CATCH block in setTimeout handler:', error);
          serverLogger.error('[API] CRITICAL ERROR from executePipeline:', error);
        } finally {
          isPipelineRunning = false;
          serverLogger.info('[API] Pipeline lock released.');
          console.log('[DIAGNOSTIC] Pipeline lock released in FINALLY block.');
        }
      }, 0); // Delay of 0ms means "run this as soon as you can".
    });
    console.log('Step 4: Express routes configured.');

    console.log('Step 5: Starting Express server listener...');
    app.listen(port, host, () => {
      console.log(`✅✅✅ [SERVER STARTING NOW] Express server is now listening on http://${host}:${port} ✅✅✅`);
    });
  } catch (error) {
    bootLogger.error('💥💥💥 CRITICAL STARTUP FAILURE 💥💥💥', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the server
startServer();