import type { NextConfig } from 'next';

// Security response headers applied to every route.
// - HSTS: force HTTPS for 2 years on this domain and its subdomains
// - X-Frame-Options DENY: cannot be iframed anywhere — clickjack defence
// - X-Content-Type-Options nosniff: browser must trust the Content-Type
// - Referrer-Policy strict-origin-when-cross-origin: don't leak full URLs
//   to cross-origin destinations
// - Permissions-Policy: deny camera/mic/geo/usb/payment by default
const securityHeaders = [
  { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options',            value: 'DENY' },
  { key: 'X-Content-Type-Options',     value: 'nosniff' },
  { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=(), usb=(), payment=()' },
];

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

  async headers() {
    return [
      {
        // Apply to every route. Vercel will merge with its own defaults.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

