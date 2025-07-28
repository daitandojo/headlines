// src/utils/logger.js
import pino from 'pino';
import { LOG_LEVEL, IS_PRODUCTION } from '../config/index.js';

const pinoConfig = {
    level: LOG_LEVEL || 'info',
    // More concise logging by default, removing pid and hostname
    base: undefined, 
};

if (!IS_PRODUCTION) {
    pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,runStats', // MODIFIED: Ignore the verbose runStats object in console output
        },
    };
}

export const logger = pino(pinoConfig);