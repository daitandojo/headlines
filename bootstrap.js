// File: bootstrap.js
// This is the new main entry point for the application.
// Its ONLY job is to set up the environment and logging BEFORE any other code runs.

import { initializeRootLogger, loadEnvironmentFiles, setGlobalLogLevel, getLogger } from '@daitanjs/development'; // <-- FIX IS HERE
import { BASE_LOG_DIR } from './src/config/paths.js';

// Use console.log for this initial phase as the logger isn't fully configured yet.
console.log('[BOOTSTRAP] Starting application bootstrap...');

// --- Add a final-resort exit logger ---
process.on('exit', (code) => {
  // This will run if the process exits for any reason.
  console.log(`[BOOTSTRAP] Process is about to exit with code: ${code}`);
});

// 1. Load all environment files. This populates process.env correctly.
loadEnvironmentFiles({ overrideDotenv: true, debugDotenv: true });
console.log('[BOOTSTRAP] Environment files loaded.');

// 2. Initialize the root logger with the now-loaded environment variables.
initializeRootLogger({ logPath: BASE_LOG_DIR });
console.log('[BOOTSTRAP] Root logger initialized.');

// 3. Set the global log level from the environment.
setGlobalLogLevel(process.env.LOG_LEVEL || 'info');
const bootLogger = getLogger('bootstrap'); // This will now work correctly
bootLogger.info(`Global log level set to "${process.env.LOG_LEVEL || 'info'}".`);

// 4. Now that the environment is stable, dynamically import and run the main application logic.
bootLogger.info('Handing off to main application server...');
import('./app.js');