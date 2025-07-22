// src/setup/setupEnvironment.js
import { configureEnv } from '@daitanjs/development';
import { getLogger } from '@daitanjs/development'; // Or your central logger

const logger = getLogger('daitan-env-setup'); // Renamed for clarity

/**
 * Performs initial DaitanJS specific environment configuration.
 * Note: .env file loading is now primarily handled by 'src/config/env.js'.
 * This function focuses on any setup required by DaitanJS libraries themselves.
 */
export async function setupDaitanEnvironment() {
  // Renamed function for clarity
  logger.info(
    '🚀 Initializing DaitanJS-specific environment configurations...'
  );

  try {
    logger.info('🔧 Running DaitanJS configureEnv()...');
    configureEnv(); // This is the core DaitanJS setup call.
    logger.info('✅ DaitanJS configureEnv() completed.');
  } catch (error) {
    logger.error(
      '💥 CRITICAL: Error during DaitanJS configureEnv() execution.',
      {
        errorMessage: error.message,
        stack: error.stack,
      }
    );
    // This is likely a critical failure if DaitanJS libraries depend on it.
    // Re-throw to halt application startup if this setup is essential.
    throw new Error(
      `DaitanJS environment configuration (configureEnv) failed: ${error.message}`
    );
  }

  // .env file loading is now handled by src/config/env.js, which is typically imported
  // early in the application lifecycle (e.g., via src/config/index.js in app.js).
  // No need to duplicate .env loading logic here.

  logger.info('✅ DaitanJS-specific environment setup process completed.');
}
