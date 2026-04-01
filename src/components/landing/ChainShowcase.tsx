'use client';

const CHAINS = [
  { name: 'Ethereum', icon: '⟠' },
  { name: 'Polygon', icon: '⬡' },
  { name: 'BSC', icon: '◆' },
  { name: 'Arbitrum', icon: '◈' },
  { name: 'Base', icon: '●' },
  { name: 'Optimism', icon: '◉' },
  { name: 'Avalanche', icon: '▲' },
  { name: 'Solana', icon: '◎' },
];

export function ChainShowcase() {
  return (
    <section className="marketing-section" id="chains">
      <div className="marketing-section-label">Multi-Chain</div>
      <h2 className="marketing-section-title">Deploy anywhere. Audit everything.</h2>
      <p className="marketing-section-desc">
        14 chains supported across EVM and Solana. Paste any contract address — Pentagonal detects the chain automatically.
      </p>

      <div className="chain-grid">
        {CHAINS.map((chain) => (
          <div key={chain.name} className="chain-badge">
            <span className="chain-badge-icon">{chain.icon}</span>
            {chain.name}
          </div>
        ))}
      </div>
      <p className="chain-showcase-tagline">
        + Sepolia, Amoy, Fuji and 6 more testnets
      </p>
    </section>
  );
}
