import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/react/',
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'classnames',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    alias: {
      '@live-manager/common': path.resolve(__dirname, '../common/src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        dir: 'dist',
        entryFileNames: 'index.js',
      },
    },
  },
});
