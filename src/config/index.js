// This module reads from process.env and exports all configuration.
import { SOURCES } from './sources.js';

const asNumber = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

const asBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    return String(value).toLowerCase() === 'true';
};

// --- Export SOURCES ---
export { SOURCES };

// --- Database Configuration ---
export const MONGO_URI = process.env.MONGO_URI;

// --- Email & SMTP Configuration ---
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = asNumber(process.env.SMTP_PORT, 587);
export const SMTP_SECURE = asBoolean(process.env.SMTP_SECURE, true);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS;
export const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Headlines Bot';
export const HEADLINE_RECIPIENTS = (process.env.HEADLINE_RECIPIENTS || '').split(',').map(e => e.trim()).filter(Boolean);
export const SUPERVISOR_EMAIL = process.env.SUPERVISOR_EMAIL || '';

// --- Assembled SMTP_CONFIG for nodemailer ---
export const SMTP_CONFIG = {
  host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  fromName: SMTP_FROM_NAME, fromAddress: SMTP_FROM_ADDRESS
};

// --- General App Settings ---
export const DEFAULT_USER_AGENT = process.env.DEFAULT_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
export const CONCURRENCY_LIMIT = asNumber(process.env.CONCURRENCY_LIMIT, 2);

// --- Core Processing Thresholds & Settings ---
export const HEADLINES_RELEVANCE_THRESHOLD = 10;
export const ARTICLES_RELEVANCE_THRESHOLD = 10;
export const MIN_ARTICLE_CHARS = 150; // <-- THE MISSING EXPORT
export const MAX_ARTICLE_CHARS = 100000;
export const MIN_HEADLINE_CHARS = 15;
export const MAX_HEADLINE_CHARS = 500;

console.log('[CONFIG] All application configurations loaded.');