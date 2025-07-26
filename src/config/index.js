// src/config/index.js (version 1.2)
import dotenv from 'dotenv';

dotenv.config();

// --- Core App Behavior ---
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY_LIMIT, 10) || 3;
export const FORCE_EMAIL_SEND_DEV = process.env.FORCE_EMAIL_SEND_DEV === 'true';

// --- Database ---
export const MONGO_URI = process.env.MONGO_URI;

// --- LLM Configuration ---
export const KIMI_API_KEY = process.env.KIMI_API_KEY;
export const LLM_MODEL_HEADLINES = process.env.LLM_MODEL_HEADLINES || 'moonshot-v1-8k';
export const LLM_MODEL_ARTICLES = process.env.LLM_MODEL_ARTICLES || 'moonshot-v1-32k';

// --- Scraper Configuration ---
// Add your proxy URL here if you have one.
// Example format: http://user:pass@host:port
export const SCRAPER_PROXY_URL = process.env.SCRAPER_PROXY_URL || null;


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
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    fromAddress: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER,
    fromName: process.env.SMTP_FROM_NAME || 'Headlines Bot',
};

export const HEADLINE_RECIPIENTS_STR = process.env.HEADLINE_RECIPIENTS || '';
export const SUPERVISOR_EMAIL_ENV = process.env.SUPERVISOR_EMAIL || 'your-supervisor-default@example.com';
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