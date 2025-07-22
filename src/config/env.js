// File: headlines_mongo/src/config/env.js
import { getEnvVariable, getLogger } from '@daitanjs/development';
import { truncateString } from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-config-env');

logger.debug(
  'Reading environment variables into app configuration constants...'
);

// --- Define and Export Application Environment Variables using getEnvVariable ---
export const MONGO_URI = getEnvVariable(
  'MONGO_URI',
  null, // No sensible default for a connection URI
  true, // It is absolutely required for the app to function
  'string',
  'MongoDB Connection URI'
);

// --- LLM Configuration ---
export const APP_LLM_PROVIDER_HEADLINES = getEnvVariable(
  'LLM_PROVIDER_HEADLINES',
  'openai',
  false, // Not strictly required, will fall back to intelligence lib defaults
  'string',
  'LLM Provider for headline assessments (e.g., openai, groq)'
);

export const APP_LLM_MODEL_HEADLINES = getEnvVariable(
  'LLM_MODEL_HEADLINES',
  'gpt-4o-mini',
  false,
  'string',
  'LLM Model for headline assessments'
);

export const APP_LLM_PROVIDER_ARTICLES = getEnvVariable(
  'LLM_PROVIDER_ARTICLES',
  'openai',
  false,
  'string',
  'LLM Provider for full article content assessments'
);

export const APP_LLM_MODEL_ARTICLES = getEnvVariable(
  'LLM_MODEL_ARTICLES',
  'gpt-4o-mini',
  false,
  'string',
  'LLM Model for full article content assessments'
);

// --- NEW: Redis / Upstash Configuration (Optional) ---
export const REDIS_URL = getEnvVariable(
  'REDIS_URL',
  null,
  false,
  'string',
  'Redis connection string (Upstash or local) - Required if using queues'
);

export const REDIS_CONFIG = (() => {
  if (!REDIS_URL) return null;
  try {
    const url = new URL(REDIS_URL);
    return {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        username: url.username || undefined,
        password: url.password || undefined,
        tls: url.protocol === 'rediss:', // force TLS for Upstash
      },
    };
  } catch (e) {
    throw new Error(`Invalid REDIS_URL: ${e.message}`);
  }
})();

// --- Email & SMTP Configuration ---
export const SMTP_HOST = getEnvVariable('SMTP_HOST', null, false, 'string');
export const SMTP_PORT = getEnvVariable('SMTP_PORT', 587, false, 'number');
export const SMTP_SECURE = getEnvVariable(
  'SMTP_SECURE',
  true,
  false,
  'boolean'
);
export const SMTP_USER = getEnvVariable('SMTP_USER', null, false, 'string');
export const SMTP_PASS = getEnvVariable('SMTP_PASS', null, false, 'string');
export const SMTP_FROM_ADDRESS = getEnvVariable(
  'SMTP_FROM_ADDRESS',
  null,
  false,
  'string'
);
export const SMTP_FROM_NAME = getEnvVariable(
  'SMTP_FROM_NAME',
  'Headlines Bot',
  false,
  'string'
);

export const HEADLINE_RECIPIENTS_STR = getEnvVariable(
  'HEADLINE_RECIPIENTS',
  'reconozco@gmail.com,christiansenalexandra@gmail.com',
  false,
  'string',
  'Headline Email Recipients (comma-separated)'
);
export const SUPERVISOR_EMAIL_ENV = getEnvVariable(
  'SUPERVISOR_EMAIL',
  '',
  false,
  'string',
  'Supervisor Email Address'
);
export const SEND_TO_DEFAULT_SUPERVISOR_ENV = getEnvVariable(
  'SEND_TO_DEFAULT_SUPERVISOR',
  false,
  false,
  'boolean',
  'Flag to send to default supervisor email if no specific one is set'
);

// --- General App Settings ---
export const NODE_ENV = getEnvVariable('NODE_ENV', 'development', false);
export const IS_PRODUCTION = NODE_ENV === 'production';
export const LOG_LEVEL = getEnvVariable(
  'LOG_LEVEL',
  IS_PRODUCTION ? 'info' : 'debug',
  false
);

export const DEFAULT_USER_AGENT = getEnvVariable(
  'DEFAULT_USER_AGENT',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  false
);
export const CONCURRENCY_LIMIT = getEnvVariable(
  'CONCURRENCY_LIMIT',
  5,
  false,
  'number'
);
export const FLY_API_TOKEN = getEnvVariable(
  'FLY_API_TOKEN',
  null,
  false,
  'string'
);

// --- Debug Flags ---
export const AI_VERBOSE = getEnvVariable('AI_VERBOSE', false, false, 'boolean');

// Log a confirmation that environment variables have been read.
if (MONGO_URI) {
  logger.debug(
    `src/config/env.js: MONGO_URI confirmed as SET for export: ${truncateString(
      MONGO_URI,
      40
    )}`
  );
} else {
  logger.error(
    'src/config/env.js: MONGO_URI IS UNDEFINED. The application will fail at database connection.'
  );
}
