import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// VERSION lives one directory up (repo root), shared with the Dockerfile-based
// build of the old vanilla-JS app. Read at build/dev-server start time and
// baked in as a compile-time constant — replaces the old sed-into-app.js step.
const versionPath = fileURLToPath(new URL('../VERSION', import.meta.url));
const appVersion = readFileSync(versionPath, 'utf-8').trim();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: true,
    port: 5173,
  },
});
