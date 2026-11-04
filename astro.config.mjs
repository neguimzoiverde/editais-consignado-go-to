// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind({ applyBaseStyles: true })],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '4340'),
  },
  security: {
    checkOrigin: false,
  },
});
