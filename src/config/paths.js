// File: src/config/paths.js (version 1.01)
import { fileURLToPath } from 'url';
import { dirname, resolve, join as pathJoin } from 'path';
import {
  getLogger,
  getOptionalEnvVariable as libGetEnvVariable,
} from '@daitanjs/development';
import { ensureDirectoryExistsSync } from '@daitanjs/utilities';

// --- FIX: Use console.log for initial path diagnostics before logger is fully trusted ---
console.log('[PATHS] src/config/paths.js module loading...');

const logger = getLogger('headlines-mongo-config-paths');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Project Root for headlines_mongo ---
export const PROJECT_ROOT = resolve(__dirname, '..', '..');
console.log(`[PATHS] Project root resolved to: ${PROJECT_ROOT}`);

// --- Directory Names ---
const OUTPUT_DIR_NAME_FROM_ENV = libGetEnvVariable(
  'APP_OUTPUT_DIR_NAME',
  'output',
  false,
  'string'
);
const LOG_DIR_NAME_FROM_ENV = libGetEnvVariable(
  'APP_LOG_DIR_NAME',
  'logs',
  false,
  'string'
);

// --- Base Directories ---
export const BASE_APP_DIR = libGetEnvVariable(
  'BASE_APP_DIR_PATHS',
  PROJECT_ROOT,
  false,
  'string'
);

export const BASE_OUTPUT_DIR = pathJoin(BASE_APP_DIR, OUTPUT_DIR_NAME_FROM_ENV);
export const BASE_LOG_DIR = pathJoin(BASE_APP_DIR, LOG_DIR_NAME_FROM_ENV);

console.log(`[PATHS] Base output directory set to: ${BASE_OUTPUT_DIR}`);
console.log(`[PATHS] Base log directory set to: ${BASE_LOG_DIR}`);

// --- Specific File Paths ---
export const HEADLINES_PATH = pathJoin(BASE_OUTPUT_DIR, 'headlines.json');
export const ARTICLES_PATH = pathJoin(BASE_OUTPUT_DIR, 'articles.json');

// --- Ensure directories exist ---
try {
  console.log(`[PATHS] Ensuring existence of output directory: ${BASE_OUTPUT_DIR}`);
  ensureDirectoryExistsSync(BASE_OUTPUT_DIR, { loggerInstance: logger });
  console.log('[PATHS] Output directory check complete.');

  console.log(`[PATHS] Ensuring existence of log directory: ${BASE_LOG_DIR}`);
  ensureDirectoryExistsSync(BASE_LOG_DIR, { loggerInstance: logger });
  console.log('[PATHS] Log directory check complete.');

  logger.info(`Application paths configured and directories ensured.`);
} catch (error) {
  // --- FIX: Use console.error for critical path creation failures ---
  console.error(
    `[PATHS] ❌ CRITICAL: Failed to ensure essential directories: ${error.message}`,
    error
  );
  // Re-throw to halt application startup, which is the correct behavior.
  throw error;
}

console.log('[PATHS] src/config/paths.js module finished loading.');