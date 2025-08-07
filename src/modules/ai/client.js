// src/modules/ai/client.js (version 1.0)
import OpenAI from 'openai';
import { GROQ_API_KEY } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not defined in the environment variables.');
}

logger.info('🤖 Initializing Groq AI client...');

// The timeout and maxRetries are configured for robustness, suitable for production use.
const groq = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 90 * 1000, // 90 seconds
    maxRetries: 3,
});

export default groq;