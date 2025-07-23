// File: bootstrap.js
// This is the NEW and ONLY entry point for the application.
// It sets up the environment and logging BEFORE any other module runs.

// --- THE FIX IS ON THIS LINE ---
import { initializeRootLogger, loadEnvironmentFiles, setGlobalLogLevel, getLogger } from '@daitanjs/development';
import { BASE_LOG_DIR } from './src/config/paths.js';

// Use console.log for this initial phase
console.log('[BOOTSTRAP] Starting application bootstrap...');

process.on('exit', (code) => {
  console.log(`[BOOTSTRAP] Process is about to exit with code: ${code}`);
});

// 1. Load environment files with OVERRIDE set to TRUE.
loadEnvironmentFiles({ overrideDotenv: true, debugDotenv: true });
console.log('[BOOTSTRAP] Environment files loaded.');

// 2. Initialize the root logger.
initializeRootLogger({ logPath: BASE_LOG_DIR });
console.log('[BOOTSTRAP] Root logger initialized.');

// 3. Set the global log level.
setGlobalLogLevel(process.env.LOG_LEVEL || 'info');
const bootLogger = getLogger('bootstrap'); // This line will now work
bootLogger.info(`Global log level set to "${process.env.LOG_LEVEL || 'info'}".`);

// 4. Hand off to the main application.
bootLogger.info('Handing off to main application server...');
import('./app.js');