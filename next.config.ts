import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4001/api/v1/:path*',
      },
      {
        source: '/marketplace/v1/:path*',
        destination: 'http://localhost:4002/marketplace/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
