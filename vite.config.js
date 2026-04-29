import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify(packageJson.version)
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
