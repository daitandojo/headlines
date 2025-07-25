import express from 'express';
import { getLogger } from '@daitanjs/development';

// NOTE: We are NOT importing the full app logic or other modules yet.
// We are keeping this as minimal as possible.

const bootLogger = getLogger('server-boot');
bootLogger.info('MINIMAL TEST: app.js module execution started.');

async function startServer() {
  bootLogger.info('MINIMAL TEST: startServer() entered.');

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

    // --- TEST 1: A simple async task that does nothing but wait and log ---
    setTimeout(async () => {
      console.log('[DIAGNOSTIC] setTimeout callback initiated. Starting FAKE pipeline.');
      serverLogger.info('FAKE PIPELINE: Starting...');
      isPipelineRunning = true;
      try {
        // Simulate a long-running task
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
        serverLogger.info('FAKE PIPELINE: Task finished successfully.');
        console.log('[DIAGNOSTIC] FAKE pipeline finished.');
      } catch (error) {
        serverLogger.error('FAKE PIPELINE: Error occurred:', error);
      } finally {
        isPipelineRunning = false;
        serverLogger.info('FAKE PIPELINE: Lock released.');
        console.log('[DIAGNOSTIC] FAKE pipeline lock released.');
      }
    }, 0);
  });

  app.listen(port, host, () => {
    bootLogger.info(`✅✅✅ [SERVER START] Express server is now listening on http://${host}:${port} ✅✅✅`);
  });
}

startServer();