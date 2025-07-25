import express from 'express';

// We are NOT importing ANY DaitanJS libraries yet.
// We are only using Express.

console.log('[MINIMAL TEST 1] app.js starting...');

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';
const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
let isPipelineRunning = false;

app.get('/health', (req, res) => {
  console.log('[MINIMAL TEST 1] Health check hit.');
  res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning });
});

app.post('/run-pipeline', (req, res) => {
  console.log('[MINIMAL TEST 1] /run-pipeline endpoint hit.');

  if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) {
    console.log('[MINIMAL TEST 1] Unauthorized attempt.');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isPipelineRunning) {
    console.log('[MINIMAL TEST 1] Pipeline already running, rejecting.');
    return res.status(429).json({ message: 'Pipeline already running.' });
  }

  res.status(202).json({ message: 'Pipeline run accepted.' });

  // This is a simple, safe async task that does not import anything heavy.
  setTimeout(async () => {
    console.log('[MINIMAL TEST 1] setTimeout callback initiated. Starting FAKE pipeline.');
    isPipelineRunning = true;
    try {
      // Simulate a long-running task by just waiting.
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
      console.log('[MINIMAL TEST 1] FAKE pipeline finished successfully.');
    } catch (error) {
      console.error('[MINIMAL TEST 1] FAKE pipeline error:', error);
    } finally {
      isPipelineRunning = false;
      console.log('[MINIMAL TEST 1] FAKE pipeline lock released.');
    }
  }, 0);
});

app.listen(port, host, () => {
  console.log(`✅✅✅ [MINIMAL TEST 1] Server is now listening on http://${host}:${port}`);
});