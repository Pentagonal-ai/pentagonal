'use client';

export function PricingSection() {
  return (
    <section className="marketing-section" id="pricing">
      <div className="marketing-section-label">Pricing</div>
      <h2 className="marketing-section-title">Pay per use. No subscriptions.</h2>
      <p className="marketing-section-desc">
        Transparent, on-chain crypto payments. No middlemen, no recurring fees. Pay exactly for what you use.
      </p>

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-card-title">Single Create</div>
          <div className="pricing-card-price">$20</div>
          <p className="pricing-card-desc">1 smart contract generation with full scoping conversation</p>
          <button className="pricing-card-cta">Get Started</button>
        </div>

        <div className="pricing-card">
          <div className="pricing-card-title">Single Audit</div>
          <div className="pricing-card-price">$20</div>
          <p className="pricing-card-desc">Full 5-agent security audit with auto-fix suggestions</p>
          <button className="pricing-card-cta">Get Started</button>
        </div>

        <div className="pricing-card popular">
          <div className="pricing-popular-badge">Best Value</div>
          <div className="pricing-card-title">5-Pack</div>
          <div className="pricing-card-price">$80 <span>/5 credits</span></div>
          <p className="pricing-card-desc">5 creates or audits — save $20</p>
          <button className="pricing-card-cta">Get Started</button>
        </div>

        <div className="pricing-card">
          <div className="pricing-card-title">10-Pack</div>
          <div className="pricing-card-price">$150 <span>/10 credits</span></div>
          <p className="pricing-card-desc">10 creates or audits — save $50</p>
          <button className="pricing-card-cta">Get Started</button>
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
        Edits and fixes: $10 per action
      </p>
    </section>
  );
}
