// File: src/setup/setupApp.js (version 1.03)
import { getLogger } from '@daitanjs/development';

const logger = getLogger('headlines-mongo-setup');

/**
 * Validates that critical application-specific environment variables are set.
 * This runs after dotenv has populated process.env.
 * @returns {Promise<boolean>} True if all checks pass.
 * @throws {Error} If a required environment variable is missing.
 */
export async function setupApp() {
  logger.info('⚙️  Validating critical application environment variables...');

  try {
    const requiredVars = [
        'MONGO_URI',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_FROM_ADDRESS',
        'PIPELINE_TRIGGER_KEY'
    ];

    const missingVars = [];
    for (const variable of requiredVars) {
        if (!process.env[variable]) {
            missingVars.push(variable);
        }
    }

    if(missingVars.length > 0) {
        throw new Error(`Critical environment variable(s) missing or empty: ${missingVars.join(', ')}.`);
    }

    // Check for at least one LLM API key
    if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
        logger.warn('Neither OPENAI_API_KEY nor GROQ_API_KEY is set. AI assessments will likely fail.');
    }

    logger.info('✅ Critical environment variables checks passed.');
    return true;
  } catch (error) {
    logger.error(`❌ Setup failed: ${error.message}`);
    throw error;
  }
}