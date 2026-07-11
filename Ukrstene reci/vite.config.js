import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '.vite-cache',
  server: {
    host: '127.0.0.1',
    port: 4713,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4713,
    strictPort: true,
  },
});
