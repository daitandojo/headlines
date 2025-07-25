import express from 'express';
import { getLogger } from '@daitanjs/development'; // Logger is safe, we'll keep it.
import { connectDatabase } from './src/config/database.js';
import './models/Article.js'; // CRITICAL: This line registers the Mongoose schema.
import { executeTestPipeline } from './test-pipeline.js';

const bootLogger = getLogger('server-boot');
bootLogger.info('BAREBONES TEST: app.js module execution started.');

async function startServer() {
  bootLogger.info('BAREBONES TEST: startServer() entered.');
  try {
    await connectDatabase();
    bootLogger.info('✅ BAREBONES TEST: Database connection successful.');

    const app = express();
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
    let isPipelineRunning = false;

    app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning }));

    app.post('/run-pipeline', (req, res) => {
      const serverLogger = getLogger('headlines-server');
      serverLogger.info('[API] /run-pipeline endpoint hit.');

      if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (isPipelineRunning) {
        return res.status(429).json({ message: 'Pipeline already running.' });
      }
      res.status(202).json({ message: 'Pipeline run accepted.' });

      setTimeout(async () => {
        isPipelineRunning = true;
        try {
          // Run our new, safe, self-contained pipeline
          await executeTestPipeline();
        } catch (error) {
          serverLogger.error('[API] CRITICAL ERROR from TEST pipeline:', error);
        } finally {
          isPipelineRunning = false;
          serverLogger.info('[API] TEST Pipeline lock released.');
        }
      }, 0);
    });

    app.listen(port, host, () => {
      bootLogger.info(`✅✅✅ [SERVER START] Express server is now listening on http://${host}:${port} ✅✅✅`);
    });
  } catch (error) {
    bootLogger.error('💥💥💥 BAREBONES TEST: CRITICAL STARTUP FAILURE 💥💥💥', { error: error.message });
    process.exit(1);
  }
}
startServer();