import { setupApp } from './src/setup/setupApp.js';
import { startHeadlineProcessing } from './src/workflows/startHeadlineProcessing.js';

try {
  setupApp();
} catch (error) {
  console.error("Error during setupApp:", error);
}

try {
  startHeadlineProcessing();
} catch (error) {
  console.error("Error during startHeadlineProcessing:", error);
}
