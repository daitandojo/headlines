import { initializeRootLogger, loadEnvironmentFiles, setGlobalLogLevel } from '@daitanjs/development';
import { BASE_LOG_DIR } from './src/config/paths.js';

console.log('[BOOTSTRAP] Starting application bootstrap...');

// --- Add a final-resort exit logger ---
process.on('exit', (code) => {
  // This will run if the process exits for any reason.
  console.log(`[BOOTSTRAP] Process is about to exit with code: ${code}`);
});

loadEnvironmentFiles({ overrideDotenv: true, debugDotenv: true });
console.log('[BOOTSTRAP] Environment files loaded.');

initializeRootLogger({ logPath: BASE_LOG_DIR });
console.log('[BOOTSTRAP] Root logger initialized.');

setGlobalLogLevel(process.env.LOG_LEVEL || 'info');
const bootLogger = getLogger('bootstrap');
bootLogger.info(`Global log level set to "${process.env.LOG_LEVEL || 'info'}".`);

bootLogger.info('Handing off to main application server...');
import('./app.js');