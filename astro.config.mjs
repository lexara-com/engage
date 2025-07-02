import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    },
    mode: 'directory'
  }),
  integrations: [tailwind()],
  vite: {
    define: {
      __VER__: `"${process.env.npm_package_version}"`
    },
    build: {
      cssCodeSplit: false
    }
  },
  build: {
    inlineStylesheets: 'always'
  }
});