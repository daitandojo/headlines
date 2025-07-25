import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { executePipeline } from './app-logic.js';

// --- Bootstrap Section ---
console.log('[BOOT] Starting application...');
dotenv.config();
// ---

import './models/Article.js'; // Registers the Mongoose schema.

async function startServer() {
  console.log('[BOOT] startServer() entered.');
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error('MONGO_URI is not defined in environment variables.');
    console.log('[BOOT] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ [BOOT] MongoDB connection successful.');
    
    mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
    mongoose.connection.on('disconnected', () => console.warn('Mongoose connection disconnected.'));

    const app = express();
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    const pipelineTriggerKey = process.env.PIPELINE_TRIGGER_KEY;
    let isPipelineRunning = false;

    app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pipelineRunning: isPipelineRunning }));

    app.post('/run-pipeline', (req, res) => {
      console.log('[API] /run-pipeline endpoint hit.');
      if (req.headers.authorization !== `Bearer ${pipelineTriggerKey}`) return res.status(401).json({ error: 'Unauthorized' });
      if (isPipelineRunning) return res.status(429).json({ message: 'Pipeline already running.' });
      
      res.status(202).json({ message: 'Pipeline run accepted.' });
      
      setTimeout(async () => {
        isPipelineRunning = true;
        try {
          await executePipeline();
        } catch (error) {
          console.error('[API] CRITICAL ERROR from executePipeline:', error);
        } finally {
          isPipelineRunning = false;
          console.log('[API] Pipeline lock released.');
        }
      }, 0);
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