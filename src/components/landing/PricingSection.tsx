'use client';

interface PricingSectionProps {
  onGetStarted?: (packId: string) => void;
}

export function PricingSection({ onGetStarted }: PricingSectionProps) {
  return (
    <section className="marketing-section" id="pricing">
      <div className="marketing-section-label">Pricing</div>
      <h2 className="marketing-section-title">Pay per use. No subscriptions.</h2>
      <p className="marketing-section-desc">
        Audits and contract generation cost $5 each. Fixes and compilation are free.
        AI agents can pay directly with USDC on Base via x402 — no account needed.
      </p>

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-card-title">Fix / Compile</div>
          <div className="pricing-card-price">Free</div>
          <p className="pricing-card-desc">Fix vulnerabilities and compile to ABI + bytecode — unlimited, rate limited</p>
          <button className="pricing-card-cta" onClick={() => onGetStarted?.('free')}>Get Started</button>
        </div>

        <div className="pricing-card popular">
          <div className="pricing-popular-badge">Core Product</div>
          <div className="pricing-card-title">Audit or Generate</div>
          <div className="pricing-card-price">$5 <span>/each</span></div>
          <p className="pricing-card-desc">Full 8-agent security audit or AI contract generation from natural language</p>
          <button className="pricing-card-cta" onClick={() => onGetStarted?.('single')}>Buy Credit</button>
        </div>

        <div className="pricing-card">
          <div className="pricing-card-title">5 Credit Pack</div>
          <div className="pricing-card-price">$20 <span>/5 credits</span></div>
          <p className="pricing-card-desc">5 credits for any mix of audits and generations — save $5</p>
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
        1 credit = 1 Audit or 1 Generate — your choice. Agents pay per-use via x402.
      </p>
    </section>
  );
}
