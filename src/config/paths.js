// File: headlines_mongo/src/config/paths.js
import { fileURLToPath } from 'url';
import { dirname, resolve, join as pathJoin } from 'path';
import {
  getLogger,
  getEnvVariable as libGetEnvVariable,
} from '@daitanjs/development';
import { ensureDirectoryExistsSync } from '@daitanjs/utilities';

const logger = getLogger('headlines-mongo-config-paths');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Project Root for headlines_mongo ---
export const PROJECT_ROOT = resolve(__dirname, '..', '..');
logger.debug(`Project root for headlines_mongo resolved to: ${PROJECT_ROOT}`);

// --- Directory Names (can be overridden by environment variables specific to paths) ---
const OUTPUT_DIR_NAME_FROM_ENV = libGetEnvVariable(
  'APP_OUTPUT_DIR_NAME',
  'output',
  false,
  'string',
  'Output directory name for paths.js'
);
const LOG_DIR_NAME_FROM_ENV = libGetEnvVariable(
  'APP_LOG_DIR_NAME',
  'logs',
  false,
  'string',
  'Log directory name for paths.js'
);

// --- Base Directories ---
// BASE_APP_DIR could be set if the entire app runs from a sub-directory of PROJECT_ROOT
// For most cases, PROJECT_ROOT is the base.
// EXPORTING THIS NOW
export const BASE_APP_DIR = libGetEnvVariable(
  'BASE_APP_DIR_PATHS',
  PROJECT_ROOT,
  false,
  'string',
  'Base application directory for paths.js'
);

export const BASE_OUTPUT_DIR = libGetEnvVariable(
  'APP_BASE_OUTPUT_DIR_PATHS',
  pathJoin(BASE_APP_DIR, OUTPUT_DIR_NAME_FROM_ENV),
  false,
  'string',
  'Base directory for application outputs (paths.js)'
);
export const BASE_LOG_DIR = libGetEnvVariable(
  'APP_BASE_LOG_DIR_PATHS',
  pathJoin(BASE_APP_DIR, LOG_DIR_NAME_FROM_ENV),
  false,
  'string',
  'Base directory for application logs (paths.js)'
);

// --- Specific File Paths ---
export const HEADLINES_PATH = libGetEnvVariable(
  'APP_HEADLINES_JSON_PATH',
  pathJoin(BASE_OUTPUT_DIR, 'headlines.json'),
  false,
  'string',
  'Path to legacy headlines JSON file'
);
export const ARTICLES_PATH = libGetEnvVariable(
  'APP_ARTICLES_JSON_PATH',
  pathJoin(BASE_OUTPUT_DIR, 'articles.json'),
  false,
  'string',
  'Path to legacy articles JSON file'
);

// --- Ensure directories exist ---
try {
  ensureDirectoryExistsSync(BASE_OUTPUT_DIR, { loggerInstance: logger });
  ensureDirectoryExistsSync(BASE_LOG_DIR, { loggerInstance: logger });

  logger.info(`Application paths configured and directories ensured:
    - Project Root: ${PROJECT_ROOT}
    - App Base Directory: ${BASE_APP_DIR}
    - Base Output Dir: ${BASE_OUTPUT_DIR}
    - Base Log Dir: ${BASE_LOG_DIR}
  `);
} catch (error) {
  logger.error(
    `❌ CRITICAL: Failed to ensure essential directories for paths.js: ${error.message}`
  );
  throw error;
}
