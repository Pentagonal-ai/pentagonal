import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
