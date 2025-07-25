import express from 'express';

console.log('[MINIMAL TEST 3] app.js starting...');

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';
const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
let isPipelineRunning = false;

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.post('/run-pipeline', (req, res) => {
  console.log('[MINIMAL TEST 3] /run-pipeline endpoint hit.');

  if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (isPipelineRunning) {
    return res.status(429).json({ message: 'Pipeline already running.' });
  }

  res.status(202).json({ message: 'Pipeline run accepted.' });

  // --- TEST 3: Import each module one by one to find the crasher ---
  setTimeout(async () => {
    console.log('[MINIMAL TEST 3] setTimeout callback initiated.');
    isPipelineRunning = true;
    try {
      console.log('[DIAGNOSTIC] === STARTING GRANULAR IMPORT TEST ===');

      await import('@daitanjs/development');
      console.log('[DIAGNOSTIC] SUCCESS: Imported @daitanjs/development');

      await import('./src/config/index.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/config/index.js');
      
      await import('./src/modules/mongoStore/articleOperations.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/mongoStore/articleOperations.js');
      
      await import('@daitanjs/intelligence');
      console.log('[DIAGNOSTIC] SUCCESS: Imported @daitanjs/intelligence');

      await import('./src/modules/assessments/assessHeadlines.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/assessments/assessHeadlines.js');

      await import('@daitanjs/web');
      console.log('[DIAGNOSTIC] SUCCESS: Imported @daitanjs/web');

      await import('./src/modules/scraping/fetchHeadlines.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/scraping/fetchHeadlines.js');

      await import('./src/modules/scraping/enrichWithBody.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/scraping/enrichWithBody.js');
      
      await import('./src/modules/assessments/assessArticles.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/assessments/assessArticles.js');
      
      await import('./src/modules/email/index.js');
      console.log('[DIAGNOSTIC] SUCCESS: Imported src/modules/email/index.js');

      console.log('[DIAGNOSTIC] === ALL IMPORTS SUCCEEDED ===');

    } catch (error) {
      console.error('[MINIMAL TEST 3] CATCH block during granular import:', error);
    } finally {
      isPipelineRunning = false;
      console.log('[MINIMAL TEST 3] GRANULAR IMPORT TEST FINISHED. Lock released.');
    }
  }, 0);
});

app.listen(port, host, () => {
  console.log(`✅✅✅ [MINIMAL TEST 3] Server is now listening on http://${host}:${port}`);
});