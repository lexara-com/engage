// Global test setup for Engage e2e tests
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Create screenshots directory if it doesn't exist
const setupDirectories = async () => {
  const screenshotsDir = 'tests/screenshots';
  if (!existsSync(screenshotsDir)) {
    await mkdir(screenshotsDir, { recursive: true });
  }
};

// Run setup before tests
setupDirectories().catch(console.error);

// Set up environment variables for testing
process.env.NODE_ENV = 'test';

// Global error handlers for better debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});