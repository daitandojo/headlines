
import { configureEnv } from 'daitanjs/development';
import dotenv from 'dotenv';
import path from 'path';

export function setupApp() {
  configureEnv();
  dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });
}
        