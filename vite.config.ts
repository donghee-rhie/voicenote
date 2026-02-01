import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@common': path.resolve(__dirname, 'src/common'),
    },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // Target modern Chromium version used by Electron
    target: 'chrome120',
    // Disable source maps in production for security
    sourcemap: false,
    // Use esbuild minification (default, built-in)
    minify: 'esbuild',
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for core dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI component library chunk
          ui: ['lucide-react', 'date-fns'],
          // Keep other dependencies in separate chunks
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
});
