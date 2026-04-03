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
        <meta name="keywords" content="smart contract, audit, security, solidity, rust, anchor, ethereum, solana, polygon, base, arbitrum, optimism, avalanche, bsc, AI, blockchain, web3, deployment, forge, pentagonal" />
        {/* JSON-LD Structured Data for AI & Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'SoftwareApplication',
                  name: 'Pentagonal',
                  alternateName: 'Pentagonal Smart Contract Forge',
                  description: 'Create, audit, and deploy production-grade smart contracts with AI-powered multi-agent security scanning across 14 blockchain networks.',
                  url: 'https://pentagonal.ai',
                  applicationCategory: 'DeveloperApplication',
                  operatingSystem: 'Web',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                    description: 'Pay with crypto credits',
                  },
                  featureList: [
                    'AI-powered smart contract generation',
                    '8-agent parallel security auditing',
                    'Reentrancy, flash loan, access control, gas optimization, oracle manipulation, MEV, overflow, and economic exploit detection',
                    'Auto-fix vulnerability suggestions',
                    'Self-learning security engine',
                    'Solidity and Rust/Anchor support',
                    '14 blockchain networks supported',
                    'MCP server integration for AI IDEs',
                  ],
                },
                {
                  '@type': 'Organization',
                  name: 'Pentagonal',
                  url: 'https://pentagonal.ai',
                  sameAs: [
                    'https://x.com/Pentagonalai',
                  ],
                },
              ],
            }),
          }}
        />
        {/* FAQ Structured Data for AI & Search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What is Pentagonal?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Pentagonal is an AI-powered smart contract forge that creates, audits, and deploys smart contracts across 14 blockchain networks using 8 autonomous security agents working in parallel.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How does the multi-agent audit work?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'When you submit a contract for audit, 8 specialized AI agents run in parallel — each analyzing the code for reentrancy, flash loans, access control, gas optimization, oracle manipulation, MEV/front-running, integer overflow, and economic exploits. Results are aggregated into a comprehensive security report.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What blockchain networks does Pentagonal support?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Pentagonal supports 7 EVM mainnets (Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, Avalanche) and Solana for non-EVM via Anchor/Rust programs, plus 8 testnets.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Can I use Pentagonal in my AI IDE?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Pentagonal has a native MCP (Model Context Protocol) server that integrates with Claude Desktop, Cursor, Windsurf, and any MCP-compatible AI coding client. You can also download the Clawd Skill package.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What programming languages does Pentagonal support?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Pentagonal generates and audits Solidity smart contracts for EVM chains and Rust/Anchor programs for Solana. It follows OpenZeppelin standards for Solidity and Anchor framework conventions for Solana.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How do credits work on Pentagonal?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Credits are a universal currency within Pentagonal purchased with crypto (any supported chain native token or stablecoins). Each contract generation, audit, or fix costs 1 credit. Compilation is free.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What makes Pentagonal different from other smart contract audit tools?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Three things: (1) Multi-agent architecture — 8 specialized agents vs single-pass analysis. (2) Self-learning engine — security knowledge compounds across all audits. (3) Full lifecycle — generate, audit, fix, and deploy from one platform.',
                  },
                },
              ],
            }),
          }}
        />
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
