import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds for e2e tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    setupFiles: ['tests/setup.ts'],
  },
});