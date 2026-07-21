/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone server so the prod Docker
  // image doesn't need the full node_modules tree — see Dockerfile.
  output: 'standalone',
};

module.exports = nextConfig;
