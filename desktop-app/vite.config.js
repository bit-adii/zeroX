import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  // Tell vite to use index.jsx as the entry point
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    extensions: ['.jsx', '.js', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
