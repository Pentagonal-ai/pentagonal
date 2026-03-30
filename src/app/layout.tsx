import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { ClientProviders } from '@/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'Pentagonal — Smart Contract Forge',
  description: 'Create, audit, and harden smart contracts with AI-powered multi-agent pen testing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
