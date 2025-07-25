// File: headlines_mongo/src/config/app.js
import { getEnvVariable } from '@daitanjs/development'; // For any new, specific needs
import { getLogger } from '@daitanjs/development';

const logger = getLogger('headlines-mongo-config-app');

// Most constants previously defined here by directly calling getEnvVariable
// (like IS_PRODUCTION, LOG_LEVEL, DEFAULT_USER_AGENT, CONCURRENCY_LIMIT)
// are now defined and exported from './env.js'.
// This file can be used for:
// 1. Re-exporting them if a specific import path '.../config/app' is preferred for these.
// 2. Defining other application-specific constants not directly from env vars or derived ones.

// Example of re-exporting (if desired for import structure):
export {
  IS_PRODUCTION,
  LOG_LEVEL,
  DEFAULT_USER_AGENT,
  CONCURRENCY_LIMIT,
  NODE_ENV, // Also from env.js
  // Add other constants from env.js you want to expose via this module path
} from './env.js';

// RELEVANCE_THRESHOLD (the old generic one) is superseded by:
// HEADLINES_RELEVANCE_THRESHOLD and ARTICLES_RELEVANCE_THRESHOLD
// which are defined (currently hardcoded, but could be made env-configurable via config/env.js)
// in headlines_mongo/src/config/index.js

// Example: If you had an app-specific feature flag derived from environment:
// export const ENABLE_SOME_FEATURE = getEnvVariable('APP_ENABLE_SOME_FEATURE', false, false, 'boolean');

logger.debug('Application settings module (config/app.js) processed.');
// If this file becomes completely empty because all constants are appropriately
// managed by config/env.js and config/index.js, it could be a candidate for removal.
// For now, it acts as a potential placeholder or re-exporter.
