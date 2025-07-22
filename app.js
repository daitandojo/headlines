// app.js (version 1.01)
// File: app.js
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// --- Environment Loading ---
// This code executes before any other application logic. It establishes the configuration context.

// 1. Load the project-specific .env file from the current directory.
// This is the standard and most reliable method.
console.log('[Launcher] Loading project-specific .env file...');
dotenv.config();

// 2. Load the global/shared .env file from a predictable, relative location.
// By convention, we assume it's two levels up from the project directory.
const globalEnvPath = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(globalEnvPath)) {
  console.log(`[Launcher] Loading global environment file: ${globalEnvPath}`);
  // The 'override: true' ensures that if a variable exists in both the global
  // and local .env, the global one takes precedence. Adjust if needed.
  dotenv.config({ path: globalEnvPath, override: true });
} else {
  console.warn(
    `[Launcher] Global environment file not found at expected location, skipping: ${globalEnvPath}`
  );
}

// 3. For debugging, confirm that a critical variable is loaded before proceeding.
const redisUrlStatus = process.env.REDIS_URL ? 'SET' : 'NOT SET';
console.log(`[Launcher] REDIS_URL in process.env is now: ${redisUrlStatus}`);

if (redisUrlStatus === 'NOT SET') {
  console.error(
    '[Launcher] CRITICAL: REDIS_URL was not loaded. The application will likely fail. Please ensure a .env file is available in the project root or in the directory two levels up.'
  );
}

// --- Start the Main Application ---
// Dynamically import the main application logic *after* the environment is fully configured.
// This ensures that when the DaitanJS framework modules are imported inside app-logic.js,
// they will see the environment variables that we have just loaded.
console.log(
  '[Launcher] Environment configured. Starting main application logic...'
);

import('./app-logic.js').catch((err) => {
  console.error(
    '💥 [Launcher] Failed to load or run the main application logic.',
    {
      errorMessage: err.message,
      stack: err.stack,
    }
  );
  process.exit(1);
});
