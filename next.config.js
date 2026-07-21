const fs = require('node:fs');
const path = require('node:path');

// VERSION lives at the repo root, shared with the Dockerfile-based build —
// read at build/dev-server start time and baked in as a compile-time env
// var (replaces the old Vite `define: { __APP_VERSION__ }` approach).
const appVersion = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf-8').trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone server so the prod Docker
  // image doesn't need the full node_modules tree — see Dockerfile.
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

module.exports = nextConfig;
