import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { ClientProviders } from '@/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'Pentagonal — Adversarial smart contract review',
  description: 'Pentagonal runs a permanent red team of eight specialised attackers against every contract you ship. Reentrancy, flash loans, oracle manipulation, MEV, economic exploits, arithmetic overflow, access control, and gas griefing.',
  metadataBase: new URL('https://pentagonal.ai'),
  openGraph: {
    title: 'Pentagonal — Adversarial smart contract review',
    description: 'Eight attackers, one report, every contract. Solidity and Anchor. Fourteen networks.',
    url: 'https://pentagonal.ai',
    siteName: 'Pentagonal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pentagonal — Adversarial smart contract review',
    description: 'Eight attackers, one report, every contract.',
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
                  description: 'Generate, attack, and deploy production smart contracts with an AI red team of eight specialised attackers across 14 blockchain networks.',
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
                    'AI-driven smart contract generation from plain-English specs',
                    'Adversarial review by eight specialised attackers in parallel',
                    'Reentrancy, flash loan, access control, oracle manipulation, MEV, overflow, economic exploit, and gas griefing coverage',
                    'Inline remediation diffs',
                    'Self-learning attack corpus',
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
                    text: 'Pentagonal is an AI-driven smart contract forge that generates, attacks, and deploys smart contracts across 14 blockchain networks using a permanent red team of 8 specialised adversarial agents.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How does the adversarial review work?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'When you submit a contract, eight specialised attackers run in parallel — Reentrancy Hunter, Flash Loan Attacker, Access Control Prober, Overflow Saboteur, Oracle Manipulator, MEV Predator, Economic Exploit, and Gas Griefer. Each tries to break the contract within its class. Findings are deduplicated, cross-confirmed, and graded by exploit cost.',
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
                    text: 'Security audits and contract generation each cost $5 per use. Fixes and compilation are free. Credits are purchased with crypto. AI agents can pay per-use with USDC on Base via the x402 protocol — no account needed.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What makes Pentagonal different from other smart contract audit tools?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Three things: (1) Adversarial architecture — eight specialised attackers running in parallel, not a single-pass reviewer. (2) Self-learning attack corpus — every exploit found teaches the next contract reviewed. (3) Full lifecycle — generate, attack, remediate, and deploy from one platform.',
                  },
                },
              ],
            }),
          }}
        />
        {/* Prevent flash of wrong theme on load — default to dark */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('pentagonal-theme') || 'dark';
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
