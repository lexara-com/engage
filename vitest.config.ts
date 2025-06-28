import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/durable-objects': resolve(__dirname, './src/durable-objects'),
      '@/mcp-servers': resolve(__dirname, './src/mcp-servers'),
      '@/agent': resolve(__dirname, './src/agent'),
      '@/platform': resolve(__dirname, './src/platform'),
      '@/auth': resolve(__dirname, './src/auth')
    }
  },
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