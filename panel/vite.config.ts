import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    host: true,
  },
  build:
    mode === 'ha'
      ? {
          // HA panel build: single JS module + CSS file
          rollupOptions: {
            input: 'src/ha-panel.ts',
            output: {
              entryFileNames: 'main.js',
              assetFileNames: 'main.[ext]',
              format: 'es' as const,
            },
          },
        }
      : {
          // Standalone build (default)
          rollupOptions: {
            output: {
              entryFileNames: 'main.js',
            },
          },
        },
}));
