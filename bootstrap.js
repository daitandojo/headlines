// File: bootstrap.js
// This is the new main entry point for the application.
// Its ONLY job is to set up the environment and logging BEFORE any other code runs.

import { initializeRootLogger, loadEnvironmentFiles, setGlobalLogLevel } from '@daitanjs/development';
import { BASE_LOG_DIR } from './src/config/paths.js';

// Use console.log for this initial phase as the logger isn't fully configured yet.
console.log('[BOOTSTRAP] Starting application bootstrap...');

// 1. Load all environment files. This populates process.env correctly.
// Now, any subsequent module import will see the correct environment variables.
loadEnvironmentFiles({ debugDotenv: true }); // Enable debug to see the file load order
console.log('[BOOTSTRAP] Environment files loaded.');

// 2. Initialize the root logger with the now-loaded environment variables.
initializeRootLogger({ logPath: BASE_LOG_DIR });
console.log('[BOOTSTRAP] Root logger initialized.');

// 3. Set the global log level from the environment.
setGlobalLogLevel(process.env.LOG_LEVEL || 'info');
const bootLogger = initializeRootLogger.getLogger ? initializeRootLogger.getLogger('bootstrap') : console; // Safety check
bootLogger.info(`[BOOTSTRAP] Global log level set to "${process.env.LOG_LEVEL || 'info'}".`);

// 4. Now that the environment is stable, dynamically import and run the main application logic.
bootLogger.info('[BOOTSTRAP] Handing off to main application server...');
import('./app.js');