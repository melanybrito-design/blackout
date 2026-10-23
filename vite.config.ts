import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages sirve este sitio desde /blackout/.
  base: process.env.GITHUB_ACTIONS ? '/blackout/' : '/',
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
