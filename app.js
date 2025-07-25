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

    // --- TEST 2: Just try to import the module ---
    setTimeout(async () => {
      console.log('[DIAGNOSTIC] setTimeout callback initiated. Preparing to IMPORT pipeline.');
      isPipelineRunning = true;
      try {
        console.log('[DIAGNOSTIC] PRE-AWAIT dynamic import of app-logic.');
        const { executePipeline } = await import('./app-logic.js');
        console.log('[DIAGNOSTIC] POST-AWAIT dynamic import of app-logic. IMPORT SUCCEEDED.');
        serverLogger.info('IMPORT TEST: Successfully imported executePipeline. NOT running it.');
      } catch (error) {
        console.error('[DIAGNOSTIC] CATCH block during import:', error);
        serverLogger.error('IMPORT TEST: Error during import:', error);
      } finally {
        isPipelineRunning = false;
        serverLogger.info('IMPORT TEST: Lock released.');
        console.log('[DIAGNOSTIC] IMPORT TEST lock released.');
      }
    }, 0);
  });
  
  app.listen(port, host, () => {
    bootLogger.info(`✅✅✅ [SERVER START] Express server is now listening on http://${host}:${port} ✅✅✅`);
  });
}

startServer();