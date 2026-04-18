import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  base: '/vue/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/audit-api': {
        target: 'http://127.0.0.1:3080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/audit-api/, ''),
      },
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
