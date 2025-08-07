// src/modules/ai/client.js (version 2.0)
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not defined in the environment variables.');
}

logger.info('🤖 Initializing OpenAI AI client...');

// The timeout and maxRetries are configured for robustness, suitable for production use.
const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
    // BaseURL is omitted to use the official OpenAI endpoint by default.
    timeout: 90 * 1000, // 90 seconds
    maxRetries: 3,
});

export default client;