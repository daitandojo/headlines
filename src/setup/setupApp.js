// File: headlines_mongo/src/setup/setupApp.js
import { getLogger, getEnvVariable } from '@daitanjs/development'; // IMPORT getEnvVariable FROM LIBRARY

// Constants like MONGO_URI, SMTP_USER, etc., are defined in '../config/env.js'
// and made available to the application via '../config/index.js'.
// This setupApp module's role is to *validate* that those (and other critical ones)
// have been successfully loaded into process.env by the time this runs.

const logger = getLogger('headlines-mongo-setup');

/**
 * Validates that critical application-specific environment variables are set.
 * Relies on getEnvVariable from @daitanjs/development.
 *
 * This function is called early in the application lifecycle (in app.js).
 * @returns {Promise<boolean>} True if all checks pass (or rather, doesn't throw).
 * @throws {Error} If a required environment variable is missing.
 */
export async function setupApp() {
  logger.info('⚙️  Validating critical application environment variables...');

  try {
    // The main .env file loading (local and potentially global) is handled by
    // headlines_mongo/src/config/env.js calling loadEnvironmentFiles from @daitanjs/development.
    // This function now focuses on *validating* that the necessary variables are accessible
    // via process.env after that loading has occurred.

    // Validate REQUIRED environment variables for headlines_mongo
    // getEnvVariable will throw if isRequired=true and the var is missing/empty.
    logger.debug('Validating MONGO_URI existence...');
    getEnvVariable('MONGO_URI', null, true, 'string', 'MongoDB Connection URI');
  
    logger.debug('Validating SMTP_USER existence...');
    getEnvVariable(
      'SMTP_USER',
      null,
      true,
      'string',
      'SMTP Username for sending emails'
    );

    logger.debug('Validating SMTP_PASS existence...');
    getEnvVariable(
      'SMTP_PASS',
      null,
      true,
      'string',
      'SMTP Password for sending emails'
    );
    logger.debug('Validating SMTP_FROM_ADDRESS existence...');
    getEnvVariable(
      'SMTP_FROM_ADDRESS',
      null,
      true,
      'string',
      'SMTP From Address for sending emails'
    );

    // Check for recipient configurations; not strictly fatal if missing for app start,
    // but email sending for those types will fail.
    logger.debug('Checking HEADLINE_RECIPIENTS...');
    getEnvVariable(
      'HEADLINE_RECIPIENTS',
      '',
      false,
      'string',
      'Recipients for wealth event emails'
    );

    logger.debug('Checking SUPERVISOR_EMAIL...');
    getEnvVariable(
      'SUPERVISOR_EMAIL',
      '',
      false,
      'string',
      'Recipient for supervisor reports'
    );

    // Validate LLM configuration existence
    logger.debug('Checking LLM_PROVIDER...');
    getEnvVariable(
      'LLM_PROVIDER',
      'openai',
      false,
      'string',
      'Default LLM Provider'
    );
    logger.debug('Checking LLM_MODEL...');
    getEnvVariable(
      'LLM_MODEL',
      'gpt-4o-mini',
      false,
      'string',
      'Default LLM Model'
    );

    // Add checks for any other environment variables this specific application (headlines_mongo)
    // absolutely requires to function, beyond what individual modules might check.
    // For example, if a specific API key was only used by app.js logic:
    // getEnvVariable('HEADLINES_MONGO_SPECIFIC_KEY', null, true, 'string', 'A critical app-specific key');

    logger.info(
      '✅ Critical environment variables checks passed (required ones are present).'
    );
    return true;
  } catch (error) {
    logger.error(
      `❌ Failed application setup: Critical environment variable check failed - ${error.message}`
    );
    throw error; // Re-throw to be caught by the main error handler in app.js
  }
}
