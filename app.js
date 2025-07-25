import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { executePipeline } from './app-logic.js';

console.log('[BOOT] Starting application...');
dotenv.config();

import './models/Article.js';

async function startServer() {
  console.log('[BOOT] startServer() entered.');
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error('MONGO_URI is not defined.');
    console.log('[BOOT] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ [BOOT] MongoDB connection successful.');

    const app = express();
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
    let isPipelineRunning = false;

    app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning }));

    // --- DEFINITIVE FIX: Make the handler async and await the pipeline ---
    app.post('/run-pipeline', async (req, res) => {
      console.log('[API] /run-pipeline endpoint hit.');
      if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) return res.status(401).json({ error: 'Unauthorized' });
      if (isPipelineRunning) return res.status(429).json({ message: 'Pipeline already running.' });

      isPipelineRunning = true;
      console.log('[API] Pipeline lock acquired. Starting execution...');
      
      try {
        await executePipeline();
        console.log('[API] Pipeline execution finished successfully.');
        // Now that it's done, send the final response.
        res.status(200).json({ message: 'Pipeline finished successfully.' });
      } catch (error) {
        console.error('[API] CRITICAL ERROR from executePipeline:', error);
        res.status(500).json({ message: 'Pipeline failed with an error.' });
      } finally {
        isPipelineRunning = false;
        console.log('[API] Pipeline lock released.');
      }
    });

    app.listen(port, host, () => {
      console.log(`✅✅✅ [SERVER START] Express server is now listening on http://${host}:${port}`);
    });
  } catch (error) {
    console.error('💥💥💥 CRITICAL STARTUP FAILURE 💥💥💥', error);
    process.exit(1);
  }
}

startServer();