// src/config/index.js (version 1.3)
import dotenv from 'dotenv';

dotenv.config();

/**
 * Helper function to safely read and clean string environment variables.
 * It trims whitespace and removes surrounding quotes.
 * @param {string} key The environment variable key.
 * @param {string} defaultValue The default value if the key is not found.
 * @returns {string} The cleaned environment variable value.
 */
function getCleanStringEnv(key, defaultValue = '') {
    let value = process.env[key] || defaultValue;
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}


// --- Core App Behavior ---
export const NODE_ENV = getCleanStringEnv('NODE_ENV', 'development');
export const IS_PRODUCTION = NODE_ENV === 'production';
export const LOG_LEVEL = getCleanStringEnv('LOG_LEVEL', 'info');
export const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY_LIMIT, 10) || 3;
export const FORCE_EMAIL_SEND_DEV = process.env.FORCE_EMAIL_SEND_DEV === 'true';

// --- Database ---
export const MONGO_URI = getCleanStringEnv('MONGO_URI');

// --- LLM Configuration ---
export const KIMI_API_KEY = getCleanStringEnv('KIMI_API_KEY');
export const LLM_MODEL_HEADLINES = getCleanStringEnv('LLM_MODEL_HEADLINES', 'moonshot-v1-8k');
export const LLM_MODEL_ARTICLES = getCleanStringEnv('LLM_MODEL_ARTICLES', 'moonshot-v1-32k');

// --- Scraper Configuration ---
export const SCRAPER_PROXY_URL = getCleanStringEnv('SCRAPER_PROXY_URL') || null;


// --- Thresholds ---
export const HEADLINES_RELEVANCE_THRESHOLD = 30;
export const ARTICLES_RELEVANCE_THRESHOLD = 70;
export const MIN_ARTICLE_CHARS = 150;
export const MAX_ARTICLE_CHARS = 100000;
export const MIN_HEADLINE_CHARS = 15;
export const MAX_HEADLINE_CHARS = 500;
export const AI_BATCH_SIZE = 6;

// --- Email Configuration ---
export const SMTP_CONFIG = {
    host: getCleanStringEnv('SMTP_HOST'),
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: getCleanStringEnv('SMTP_USER'),
        pass: getCleanStringEnv('SMTP_PASS'),
    },
    fromAddress: getCleanStringEnv('SMTP_FROM_ADDRESS') || getCleanStringEnv('SMTP_USER'),
    fromName: getCleanStringEnv('SMTP_FROM_NAME', 'Headlines Bot'),
};

export const HEADLINE_RECIPIENTS_STR = getCleanStringEnv('HEADLINE_RECIPIENTS');
export const SUPERVISOR_EMAIL_ENV = getCleanStringEnv('SUPERVISOR_EMAIL', 'your-supervisor-default@example.com');
export const SEND_TO_DEFAULT_SUPERVISOR_ENV = process.env.SEND_TO_DEFAULT_SUPERVISOR === 'true';

// Derived Email Config
export const HEADLINE_RECIPIENTS = HEADLINE_RECIPIENTS_STR.split(',').map(e => e.trim()).filter(Boolean);
export const SUPERVISOR_EMAIL = SUPERVISOR_EMAIL_ENV;
export const SEND_TO_DEFAULT_SUPERVISOR = SEND_TO_DEFAULT_SUPERVISOR_ENV;

// --- Email Template Config ---
export const EMAIL_CONFIG = {
  templateName: 'wealthEvents',
  subject: '🇩🇰 New Danish Banking Opportunities Detected',
  language: 'en',
  brandName: 'Wealth Watch Denmark',
  companyAddress: 'Wealth Watch Inc., Copenhagen, Denmark',
  unsubscribeUrl: '#',
};

export const SUPERVISOR_EMAIL_CONFIG = {
  templateName: 'supervisorReport',
  subject: '⚙️ Hourly Headlines Processing Run Summary',
  language: 'en',
  brandName: 'Headlines Processing Bot',
};