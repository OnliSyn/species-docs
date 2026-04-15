import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

/** Turbopack must resolve deps from this app, not a parent folder with another lockfile. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: turbopackRoot,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4001/api/v1/:path*',
      },
      {
        source: '/marketplace/v1/:path*',
        destination: 'http://localhost:4012/marketplace/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
