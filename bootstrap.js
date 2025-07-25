import { initializeRootLogger, loadEnvironmentFiles, setGlobalLogLevel, getLogger } from '@daitanjs/development';
import { BASE_LOG_DIR } from './src/config/paths.js';

console.log('[BOOTSTRAP] Starting application bootstrap...');

process.on('exit', (code) => {
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