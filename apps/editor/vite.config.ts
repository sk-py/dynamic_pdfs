import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The editor talks to the render API through /api so you don't need CORS in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:4000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
