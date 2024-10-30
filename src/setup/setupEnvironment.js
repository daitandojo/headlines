// File: src/setup/setupEnvironment.js

import { configureEnv } from 'daitanjs/development';
import dotenv from 'dotenv';
import path from 'path';

export function setupEnvironment() {
  configureEnv();
  dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });
}
