import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configuredBasePath = (process.env.VITE_BASE_PATH || '').replace(/^\/|\/$/g, '');
const basePath = configuredBasePath ? `/${configuredBasePath}/` : '/';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  build: {
    outDir: configuredBasePath ? `dist/${configuredBasePath}` : 'dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
        changeOrigin: true
      }
    }
  }
});
