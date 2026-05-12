import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: path.resolve('frontend/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws':  { target: 'ws://localhost:3000', ws: true },
      '/ml':  'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
});
