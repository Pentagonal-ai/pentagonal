import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Externalize @anthropic-ai/sdk so Next.js doesn't bundle it through webpack.
  // When bundled, Next.js replaces native Node.js networking with its patched fetch,
  // which breaks outbound HTTPS connections to api.anthropic.com in Vercel production.
  // Externalizing forces the SDK to load from node_modules at runtime with native HTTP.
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default nextConfig;

