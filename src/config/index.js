// src/config/index.js (version 2.3 - Pinecone Integration)
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
export const IS_REFRESH_MODE = process.env.REFRESH_MODE === 'true';

// --- Database ---
export const MONGO_URI = getCleanStringEnv('MONGO_URI');

// --- NEW: Pinecone Configuration ---
export const PINECONE_API_KEY = getCleanStringEnv('PINECONE_API_KEY');
export const PINECONE_INDEX_NAME = getCleanStringEnv('PINECONE_INDEX_NAME', 'headlines');

// --- LLM Configuration ---
export const OPENAI_API_KEY = getCleanStringEnv('OPENAI_API_KEY');
export const LLM_MODEL = getCleanStringEnv('LLM_MODEL', 'gpt-5-mini');
export const LLM_MODEL_TRIAGE = LLM_MODEL;
export const LLM_MODEL_HEADLINES = LLM_MODEL;
export const LLM_MODEL_ARTICLES = LLM_MODEL;

// --- Scraper Configuration ---
export const SCRAPER_PROXY_URL = getCleanStringEnv('SCRAPER_PROXY_URL') || null;

// --- NEW: Third-Party Service APIs ---
export const SERPAPI_API_KEY = getCleanStringEnv('SERPAPI_API_KEY');

// --- Thresholds ---
export const HEADLINES_RELEVANCE_THRESHOLD = 20;
export const ARTICLES_RELEVANCE_THRESHOLD = 50;
export const MIN_ARTICLE_CHARS = 150;
export const MAX_ARTICLE_CHARS = 100000;
export const MIN_HEADLINE_CHARS = 5;
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

// --- Email Template Config ---
export const EMAIL_CONFIG = {
  templateName: 'wealthEvents',
  subject: 'New Nordic Banking Opportunities Detected',
  language: 'en',
  brandName: 'Your Wealth Watch',
  companyAddress: 'Wealth Watch Inc., Paris, France',
  unsubscribeUrl: '#',
};

export const SUPERVISOR_EMAIL_CONFIG = {
  templateName: 'supervisorReport',
  subject: '⚙️ Hourly Headlines Processing Run Summary',
  language: 'en',
  brandName: 'Headlines Processing Bot',
};