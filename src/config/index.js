// File: headlines_mongo/src/config/index.js

// --- Environment Variable Sourced Configurations ---
export {
  MONGO_URI,
  HEADLINE_RECIPIENTS_STR,
  NODE_ENV,
  IS_PRODUCTION,
  LOG_LEVEL,
  DEFAULT_USER_AGENT,
  CONCURRENCY_LIMIT,
  APP_LLM_PROVIDER_HEADLINES,
  APP_LLM_MODEL_HEADLINES,
  APP_LLM_PROVIDER_ARTICLES,
  APP_LLM_MODEL_ARTICLES,
  AI_VERBOSE,
  FLY_API_TOKEN,
} from './env.js';

export { REDIS_URL, REDIS_CONFIG } from './env.js';

// --- Path Configurations ---
export {
  PROJECT_ROOT,
  BASE_APP_DIR,
  BASE_OUTPUT_DIR,
  BASE_LOG_DIR,
  HEADLINES_PATH,
  ARTICLES_PATH,
} from './paths.js';

// --- Email Styling, Content, Recipient, and SMTP Configurations ---
export * from './email.js';

// --- Source Configurations ---
export * from './sources.js';

// --- Core Processing Thresholds & Settings ---
export const HEADLINES_RELEVANCE_THRESHOLD = 10;
export const ARTICLES_RELEVANCE_THRESHOLD = 10;
export const MIN_ARTICLE_CHARS = 150;
export const MAX_ARTICLE_CHARS = 100000;
export const MIN_HEADLINE_CHARS = 15;
export const MAX_HEADLINE_CHARS = 500;
export const BATCH_SIZE = 5;
export const MAX_APP_RETRIES = 3;
export const APP_RETRY_DELAY_MS = 1000;

// --- Deprecated ---
// This is kept for backward compatibility if any module still imports it directly.
// It is recommended to use the more specific ARTICLES_RELEVANCE_THRESHOLD instead.
export const RELEVANCE_THRESHOLD = ARTICLES_RELEVANCE_THRESHOLD;

import { getLogger as getMainLogger } from '@daitanjs/development';
const centralConfigLogger = getMainLogger('headlines-mongo-config-index');
centralConfigLogger.info(
  '✅ All application configurations aggregated and exported from headlines_mongo/src/config/index.js.'
);
