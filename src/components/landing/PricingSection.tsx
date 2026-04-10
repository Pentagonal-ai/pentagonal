'use client';

interface PricingSectionProps {
  onGetStarted?: (packId: string) => void;
}

export function PricingSection({ onGetStarted }: PricingSectionProps) {
  return (
    <section className="marketing-section" id="pricing">
      <div className="marketing-section-label">Pricing</div>
      <h2 className="marketing-section-title">Only pay for audits. Everything else is free.</h2>
      <p className="marketing-section-desc">
        Generate, fix, and compile contracts at no cost. The full 8-agent security audit is the only paid feature — pay with credits or let your agent pay with USDC on Base.
      </p>

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-card-title">Generate / Fix / Compile</div>
          <div className="pricing-card-price">Free</div>
          <p className="pricing-card-desc">Create contracts, fix vulnerabilities, compile to ABI + bytecode — unlimited, rate limited</p>
          <button className="pricing-card-cta" onClick={() => onGetStarted?.('free')}>Get Started</button>
        </div>

        <div className="pricing-card popular">
          <div className="pricing-popular-badge">Core Product</div>
          <div className="pricing-card-title">Security Audit</div>
          <div className="pricing-card-price">$5 <span>/audit</span></div>
          <p className="pricing-card-desc">8-agent adversarial pen test with severity grouping and PoC exploits</p>
          <button className="pricing-card-cta" onClick={() => onGetStarted?.('single')}>Buy Credit</button>
        </div>

        <div className="pricing-card">
          <div className="pricing-card-title">5 Audit Pack</div>
          <div className="pricing-card-price">$20 <span>/5 audits</span></div>
          <p className="pricing-card-desc">5 audit credits — save $5</p>
          <button className="pricing-card-cta" onClick={() => onGetStarted?.('pack_5')}>Buy Pack</button>
        </div>
      </div>

      <div className="pricing-tokens">
        <span>Accepted:</span>
        <span className="pricing-token-badge">USDC</span>
        <span className="pricing-token-badge">USDT</span>
        <span className="pricing-token-badge">SOL</span>
        <span className="pricing-token-badge">ETH</span>
        <span className="pricing-token-badge">BNB</span>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
        AI agents can pay per-audit with USDC on Base via x402 — no account needed
      </p>
    </section>
  );
}
