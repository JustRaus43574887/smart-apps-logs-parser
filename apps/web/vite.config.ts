import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/smart-apps-logs-parser/',
  build: {
    outDir: 'build',
  },
  publicDir: 'public',
  server: {
    open: true,
  },
});
