import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Allow long-running AI routes (audit takes 2-4 min for 8 agents)
  serverExternalPackages: [],
};

export default nextConfig;

