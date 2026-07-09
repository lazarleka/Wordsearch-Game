import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '.vite-cache',
  server: {
    host: '127.0.0.1',
    port: 4713,
    strictPort: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      absWorkingDir: 'C:/Users/User/OneDrive/Desktop/grafika/Ukrstene reci localhost',
    },
  },
});
