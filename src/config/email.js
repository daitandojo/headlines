// File: headlines_mongo/src/config/email.js
import { getEnvVariable } from '@daitanjs/development'; // Import directly
import { HEADLINE_RECIPIENTS_STR, SUPERVISOR_EMAIL_ENV, SEND_TO_DEFAULT_SUPERVISOR_ENV, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_ADDRESS, SMTP_FROM_NAME } from './env.js'; // Import from local env.js

export const HEADLINE_RECIPIENTS = HEADLINE_RECIPIENTS_STR
  .split(',')
  .map((email) => email.trim())
  .filter((email) => email && email !== 'your-default-email@example.com'); // Filter out potential placeholder

// Use the value from env.js, which has its own default if SUPERVISOR_EMAIL is not in .env
export const SUPERVISOR_EMAIL = SUPERVISOR_EMAIL_ENV; 
export const SEND_TO_DEFAULT_SUPERVISOR = SEND_TO_DEFAULT_SUPERVISOR_ENV;

export const EMAIL_CONFIG = {
  templateName: 'wealthEvents',
  subject: '🇩🇰 New Danish Banking Opportunities Detected',
  language: 'en',
  brandName: 'Wealth Watch Denmark',
  maxWidth: '650px',
  backgroundColor: '#ECEFF1',
  contentBackgroundColor: '#FFFFFF',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  linkColor: '#007BFF',
  contentBorderRadius: '8px',
  contentBoxShadow: '0 4px 12px rgba(0,0,0,0.07)',
  headingColor: '#2c3e50',
  paragraphColor: '#555555',
  metaTextColor: '#777777',
  assessmentTextColor: '#333333',
  cardHeadingColor: '#333333',
  cardBackgroundColor: '#FFFFFF',
  cardBorderColor: '#E0E0E0',
  cardBorderRadius: '6px',
  cardPadding: '15px 20px',
  cardBoxShadow: '0 3px 8px rgba(0,0,0,0.07)',
  assessmentBlockBgColor: '#f8f9fa',
  assessmentBlockBorderColor: '#dee2e6',
  buttonColor: '#007BFF',
  buttonTextColor: '#FFFFFF',
  footerTextColor: '#888888',
  footerBorderColor: '#DDDDDD',
  footerLinkColor: '#777777',
  companyAddress: 'Wealth Watch Inc., Copenhagen, Denmark',
  unsubscribeUrl: '#', 
};

export const SUPERVISOR_EMAIL_CONFIG = {
  templateName: 'supervisorReport', 
  subject: '⚙️ Hourly Headlines Processing Run Summary',
  language: 'en',
  brandName: 'Headlines Processing Bot',
  maxWidth: '800px', 
  backgroundColor: '#F0F0F0',
  contentBackgroundColor: '#FFFFFF',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  linkColor: '#007BFF',
  headingColor: '#333333',
  paragraphColor: '#555555',
  metaTextColor: '#6c757d', 
  tableBorderColor: '#DDDDDD',
  tableHeaderBgColor: '#F8F8F8',
  tableCellPadding: '8px',
};

// Assemble SMTP_CONFIG here using values imported from env.js
export const SMTP_CONFIG = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  fromAddress: SMTP_FROM_ADDRESS, 
  fromName: SMTP_FROM_NAME 
};