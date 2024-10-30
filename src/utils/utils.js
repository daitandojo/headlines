// File: src/utils/utils.js

import pLimit from 'p-limit';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('utils');

// Concurrency Management
export function createLimit(concurrencyLimit = 5) {
  return pLimit(concurrencyLimit);
}

// Safe Execution Wrapper: Executes a function safely with error handling
export async function safeExecute(fn, onError) {
  try {
    return await fn();
  } catch (error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    } else {
      logger.error('Unhandled error during safeExecute', { error: error.message });
    }
    return null;
  }
}

// Retry Function with Limits: Attempts an async function multiple times
export async function retryWithLimit(asyncFn, retryLimit = 3, customLogger = logger) {
  let attempts = 0;

  while (attempts < retryLimit) {
    attempts += 1;
    try {
      customLogger.info(`Attempt ${attempts} of ${retryLimit}`);
      return await asyncFn();
    } catch (error) {
      customLogger.warn(`Attempt ${attempts} failed: ${error.message}`);
      if (attempts === retryLimit) {
        customLogger.error('Maximum retry attempts reached', { error });
        throw error;
      }
    }
  }
}

// Process Data in Batches: Process an array of data in smaller, manageable batches
export async function processInBatches(dataArray, batchSize, processingFn) {
  const result = [];
  for (let i = 0; i < dataArray.length; i += batchSize) {
    const batch = dataArray.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processingFn));
    result.push(...batchResults);
  }
  return result;
}

// Validate CSS Class Names: Checks if a CSS class name is valid
export function isValidCSSSelector(className) {
  const invalidCharacters = /[:[/ . \\]]/; // Match invalid characters for CSS class names
  return !invalidCharacters.test(className);
}

// Extract Data from Array Safely: Extracts a specific property from objects in an array
export function safelyExtractProperty(dataArray, property) {
  return dataArray
    .filter(item => item && typeof item === 'object')
    .map(item => item[property])
    .filter(Boolean);
}

// Print Summary of Analysis Results: Outputs analysis summaries to console
export function printSummary(summary) {
  if (typeof summary !== 'object') {
    logger.error('Invalid summary object');
    return;
  }
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
}

// Deep Merge Utility: Recursively merges properties of two objects
export function deepMerge(target, source) {
  if (typeof target !== 'object' || typeof source !== 'object') {
    return target;
  }

  for (const key in source) {
    if (source[key] instanceof Object) {
      if (!target[key]) {
        target[key] = {};
      }
      target[key] = deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }

  return target;
}

// Delay Utility: Adds a delay in milliseconds, useful for rate-limiting
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Group Elements by Property: Groups an array of objects by a specified property
export function groupBy(dataArray, property) {
  return dataArray.reduce((result, item) => {
    const key = item[property];
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {});
}

// Generate Random String: Generates a random string of specified length
export function generateRandomString(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
