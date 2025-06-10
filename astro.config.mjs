import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [tailwind()],
  server: {
    port: 4321,
    host: true
  },
  // Environment variables available to the client
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || 'https://dev.lexara.app'),
      'import.meta.env.PUBLIC_ADMIN_BASE_URL': JSON.stringify(process.env.ADMIN_BASE_URL || 'https://admin-dev.lexara.app'),
      'import.meta.env.PUBLIC_ENVIRONMENT': JSON.stringify(process.env.ENVIRONMENT || 'development')
    }
  }
});