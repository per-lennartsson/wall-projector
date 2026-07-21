import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" path mapping — Next.js's bundler
    // understands that on its own, but Vitest's Vite resolver needs it
    // spelled out separately.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
  },
});
