import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';
import { getSimEnv } from './src/config/sim-env';

/** Turbopack must resolve deps from this app, not a parent folder with another lockfile. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

function simRewriteOrigins(): { marketsb: string; species: string } {
  try {
    const e = getSimEnv();
    return { marketsb: e.marketsbOrigin, species: e.speciesOrigin };
  } catch {
    return { marketsb: 'http://127.0.0.1:3101', species: 'http://127.0.0.1:3102' };
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Local dev can be opened via localhost or 127.0.0.1 without HMR origin blocks.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  turbopack: {
    root: turbopackRoot,
  },
  async rewrites() {
    const { marketsb, species } = simRewriteOrigins();
    return [
      {
        source: '/api/v1/:path*',
        destination: `${marketsb}/api/v1/:path*`,
      },
      {
        source: '/marketplace/v1/:path*',
        destination: `${species}/marketplace/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
