// File: app.js (version 1.31 - Final)
import express from 'express';
import { getLogger } from '@daitanjs/development';
import { connectDatabase } from './src/config/database.js';
import { setupApp } from './src/setup/setupApp.js';
import { validateAllSourceConfigs } from './src/utils/configValidator.js';
import { executePipeline } from './app-logic.js';

const bootLogger = getLogger('server-boot');
bootLogger.info('[BOOT] app.js module execution started.');

process.setMaxListeners(30);

process.on('unhandledRejection', (reason, promise) => {
  bootLogger.error('💥 FATAL: Unhandled Rejection at:', { promise, reason });
  setTimeout(() => process.exit(1), 1000);
});
process.on('uncaughtException', (error) => {
  bootLogger.error('💥 FATAL: Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

bootLogger.info('[BOOT] Global handlers are active.');

async function startServer() {
  bootLogger.info('[BOOT] startServer() entered.');
  try {
    bootLogger.info('[BOOT] Step 1: Validating source configurations...');
    validateAllSourceConfigs();
    bootLogger.info('[BOOT] Step 1: Source configurations are valid.');

    bootLogger.info('[BOOT] Step 2: Performing application setup checks (env vars)...');
    await setupApp();
    bootLogger.info('[BOOT] Step 2: Application setup checks complete.');

    bootLogger.info('[BOOT] Step 3: Connecting to database...');
    await connectDatabase();
    bootLogger.info('✅ [BOOT] Step 3: Database connection successful.');

    const app = express();
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
    let isPipelineRunning = false;

    bootLogger.info('[BOOT] Step 4: Configuring Express server routes...');
    app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning }));

    app.post('/run-pipeline', async (req, res) => {
      const serverLogger = getLogger('headlines-server');
      serverLogger.info('[API] /run-pipeline endpoint hit.');
      if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (isPipelineRunning) {
        return res.status(429).json({ message: 'Pipeline already running.' });
      }
      res.status(202).json({ message: 'Pipeline run accepted.' });
      isPipelineRunning = true;
      try {
        await executePipeline();
      } catch (error) {
        serverLogger.error('[API] CRITICAL ERROR from executePipeline:', error);
      } finally {
        isPipelineRunning = false;
        serverLogger.info('[API] Pipeline lock released.');
      }
    });
    bootLogger.info('[BOOT] Step 4: Express routes configured.');

    bootLogger.info('[BOOT] Step 5: Starting Express server listener...');
    app.listen(port, host, () => {
      bootLogger.info(`✅✅✅ [SERVER START] Express server is now listening on http://${host}:${port} ✅✅✅`);
    });
  } catch (error) {
    bootLogger.error('💥💥💥 CRITICAL STARTUP FAILURE 💥💥💥', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the server
startServer();