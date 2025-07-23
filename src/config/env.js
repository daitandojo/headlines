// File: src/config/env.js (version 1.05)
// This module reads from the pre-populated process.env and exports constants.
// It does NOT load any files itself. `dotenv.config()` should be called in `app.js`.

import { getLogger } from '@daitanjs/development';

const logger = getLogger('config-env');
logger.debug('Reading environment variables into app configuration constants...');

// --- Helper Functions for robust type conversion ---
const asNumber = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};
const asBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    return String(value).toLowerCase() === 'true';
};

// --- Database Configuration ---
export const MONGO_URI = process.env.MONGO_URI;

// --- LLM Configuration ---
export const APP_LLM_PROVIDER_HEADLINES = process.env.LLM_PROVIDER_HEADLINES || 'openai';
export const APP_LLM_MODEL_HEADLINES = process.env.LLM_MODEL_HEADLINES || 'gpt-4o-mini';
export const APP_LLM_PROVIDER_ARTICLES = process.env.LLM_PROVIDER_ARTICLES || 'openai';
export const APP_LLM_MODEL_ARTICLES = process.env.LLM_MODEL_ARTICLES || 'gpt-4o-mini';

// --- Email & SMTP Configuration ---
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = asNumber(process.env.SMTP_PORT, 587);
export const SMTP_SECURE = asBoolean(process.env.SMTP_SECURE, true);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS;
export const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Headlines Bot';
export const HEADLINE_RECIPIENTS_STR = process.env.HEADLINE_RECIPIENTS || 'default@example.com';
export const SUPERVISOR_EMAIL_ENV = process.env.SUPERVISOR_EMAIL || '';
export const SEND_TO_DEFAULT_SUPERVISOR_ENV = asBoolean(process.env.SEND_TO_DEFAULT_SUPERVISOR);

// --- General App Settings ---
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');
export const DEFAULT_USER_AGENT = process.env.DEFAULT_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
export const CONCURRENCY_LIMIT = asNumber(process.env.CONCURRENCY_LIMIT, 5);
export const FLY_API_TOKEN = process.env.FLY_API_TOKEN || null;

// --- Debug Flags ---
export const AI_VERBOSE = asBoolean(process.env.AI_VERBOSE);

logger.info(`Environment configuration loaded. NODE_ENV: ${NODE_ENV}, LOG_LEVEL: ${LOG_LEVEL}`);