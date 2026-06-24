import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '.vite-cache',
  optimizeDeps: {
    esbuildOptions: {
      absWorkingDir: 'C:/Users/User/OneDrive/Desktop/grafika/Ukrstene reci',
    },
  },
});
