import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { ClientProviders } from '@/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'Pentagonal — Smart Contract Forge',
  description: 'Create, audit, and deploy smart contracts with AI-powered multi-agent security scanning. 5 autonomous agents. Zero blind spots.',
  metadataBase: new URL('https://pentagonal.ai'),
  openGraph: {
    title: 'Pentagonal — Smart Contract Forge',
    description: 'Create, audit, and deploy smart contracts with AI-powered multi-agent security scanning.',
    url: 'https://pentagonal.ai',
    siteName: 'Pentagonal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pentagonal — Smart Contract Forge',
    description: 'Create, audit, and deploy smart contracts with AI-powered multi-agent security scanning.',
  },
  alternates: {
    canonical: 'https://pentagonal.ai',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Prevent flash of wrong theme on load — default to light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('pentagonal-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
