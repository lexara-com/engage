import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      // Miniflare configuration for Cloudflare Workers environment
      modules: true,
      scriptPath: './dist/api-worker.js',
      durableObjects: {
        CONVERSATION_SESSION: 'ConversationSession',
        USER_IDENTITY: 'UserIdentity'
      },
      d1Databases: {
        FIRM_INDEX_DB: 'firm-indexes',
        PLATFORM_DB: 'platform-data'
      },
      kvNamespaces: {
        API_CACHE: 'api-cache'
      }
    },
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.wrangler/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/middleware': path.resolve(__dirname, './src/middleware'),
      '@/routes': path.resolve(__dirname, './src/routes'),
      '@/tests': path.resolve(__dirname, './src/tests')
    }
  }
});