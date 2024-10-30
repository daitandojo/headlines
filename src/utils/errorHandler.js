// File: src/utils/errorHandler.js

import { getLogger } from 'daitanjs/development';

const logger = getLogger('error-handler');

// Log and throw error consistently
export function logAndThrow(error, message = 'Unhandled error') {
  logger.error(message, { error: error.message, stack: error.stack });
  throw error;
}

// Safe execution with logging
export async function safeExecute(fn, message = 'Error during execution', onError = null) {
  try {
    return await fn();
  } catch (error) {
    logger.error(message, { error: error.message });
    if (onError) {
      onError(error);
    }
    return null;
  }
}
