// src/utils/logger.js (version 1.1)
import pino from 'pino';
import { LOG_LEVEL, IS_PRODUCTION } from '../config/index.js';

const pinoConfig = {
    level: LOG_LEVEL || 'info',
    // More concise logging by default, removing pid and hostname
    base: undefined, 
};

// Use pino-pretty for nice console logs in development, and clean JSON in production
if (!IS_PRODUCTION) {
    pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            // Simple time format, no system info
            translateTime: 'HH:MM:ss',
            // Remove pid and hostname from pretty print output
            ignore: 'pid,hostname', 
        },
    };
}

export const logger = pino(pinoConfig);