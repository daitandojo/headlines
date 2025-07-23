// File: scripts/test-logger.js (version 1.02)
import path from 'path';
// --- FIX: Removed 'initializeRootLogger' as it's not exported by the npm version of the package. ---
import {
  getLogger,
  setGlobalLogLevel,
} from '@daitanjs/development';
import { BASE_LOG_DIR } from '../src/config/paths.js';

// --- Main Test Function ---
async function testLogger() {
  console.log('--- Logger Test Script Starting ---');
  console.log(`This script will test the DaitanJS logger.`);
  console.log(`It will attempt to write logs to the console and to a file.`);
  console.log(`Log directory is configured as: ${BASE_LOG_DIR}`);
  console.log('-------------------------------------\n');

  try {
    // --- FIX: Initialize the logger by passing config to the *first* getLogger call. ---
    // This first call will initialize the logger with path and level.
    const testLogger = getLogger('logger-test', { logPath: BASE_LOG_DIR, logLevel: 'debug' });
    console.log('[TEST] Step 1 & 2: getLogger("logger-test") called with config successfully.');

    // Step 3: Log messages at various levels.
    console.log('[TEST] Step 3: Sending messages at different log levels...');
    testLogger.info('This is an INFO message.');
    testLogger.warn('This is a WARNING message.', {
      metadata: 'some_value',
      code: 123,
    });
    testLogger.error('This is an ERROR message.', {
      error: new Error('This is a simulated error object.').stack,
    });
    testLogger.debug('This is a DEBUG message (should be visible).');

    console.log('\n[TEST] Step 4: Dynamically changing global log level to "warn"...');
    setGlobalLogLevel('warn');
    testLogger.info(
      'This INFO message should NOT be visible in the console or file.'
    );
    testLogger.warn(
      'This second WARNING message SHOULD be visible.'
    );
    console.log('[TEST] Step 4: Log level change test complete.');
  } catch (error) {
    console.error('💥 CRITICAL ERROR during logger test:', error);
    process.exit(1);
  }

  console.log('\n-------------------------------------');
  console.log('--- Logger Test Script Finished ---');
  console.log(
    '✅ VERIFICATION: Check the console output above for colorized log messages.'
  );
  console.log(
    `✅ VERIFICATION: Check the file at "${path.join(
      BASE_LOG_DIR,
      'logger-test.log'
    )}" for structured JSON logs.`
  );
  console.log('If you see output in both places, the logger is working correctly.');
}

testLogger();