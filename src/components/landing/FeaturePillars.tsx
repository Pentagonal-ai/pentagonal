'use client';

export function FeaturePillars() {
  return (
    <section className="marketing-section" id="features">
      <div className="marketing-section-label">What Pentagonal Does</div>
      <h2 className="marketing-section-title">Three pillars. Zero compromises.</h2>
      <p className="marketing-section-desc">
        From idea to deployment — create production-grade smart contracts, audit them with 5 autonomous agents, and deploy to any chain.
      </p>

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <div className="feature-card-title">Create</div>
          <p className="feature-card-desc">
            Describe what you need in plain English. Pentagonal scopes the project with you, then generates production-ready Solidity or Rust.
          </p>
          <div className="feature-code-snippet">
            → "Build an ERC-721 with lazy minting and royalties"
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🔍</div>
          <div className="feature-card-title">Audit</div>
          <p className="feature-card-desc">
            5 specialized agents run in parallel — reentrancy, access control, arithmetic, gas optimization, and logic review. Every finding includes a fix.
          </p>
          <div className="feature-code-snippet">
            5 agents · 30 second scans · auto-fix suggestions
          </div>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🚀</div>
          <div className="feature-card-title">Deploy</div>
          <p className="feature-card-desc">
            One-click deployment to 14 chains. Connect your wallet, pick a network, and ship. Verification included.
          </p>
          <div className="feature-code-snippet">
            ETH · Polygon · BSC · Arbitrum · Base · Solana · +8 more
          </div>
        </div>
      </div>
    </section>
  );
}
