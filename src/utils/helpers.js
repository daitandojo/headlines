// src/utils/helpers.js (version 1.0)
import { logger } from './logger.js';

/**
 * Truncates a string to a specified length, adding an ellipsis if truncated.
 * @param {string} str The string to truncate.
 * @param {number} maxLength The maximum length of the string.
 * @returns {string} The truncated string.
 */
export function truncateString(str, maxLength = 100) {
    if (typeof str !== 'string' || str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength) + '...';
}

/**
 * Executes an async function and handles errors gracefully.
 * @param {() => Promise<any>} asyncFn The async function to execute.
 * @param {{errorHandler: (error: Error) => any}} options Error handling options.
 * @returns {Promise<any>} The result of the function or the error handler.
 */
export async function safeExecute(asyncFn, { errorHandler } = {}) {
    try {
        return await asyncFn();
    } catch (error) {
        if (errorHandler) {
            return errorHandler(error);
        }
        logger.error({ err: error }, 'An unexpected error occurred in a safeExecute block.');
        return null; // Default fallback
    }
}