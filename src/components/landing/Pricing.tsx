import Link from 'next/link';

export function Pricing() {
  return (
    <section className="m-section" id="pricing">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Pricing</span>
          <h2 className="m-h2">
            Per-audit. No subscriptions.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Generation and audit each cost five dollars. Compilation, fixes,
            and re-runs are free. Pay with crypto credits, or have an agent
            pay per call in USDC over x402.
          </p>
        </div>

        <div className="m-pricing">
          <div className="m-price-cell">
            <div className="m-price-name">Single audit</div>
            <div className="m-price-amount">$5<sub>/ contract</sub></div>
            <div className="m-price-desc">
              One contract, eight agents, one consolidated report. Free fixes
              and recompiles for the same contract.
            </div>
          </div>

          <div className="m-price-cell">
            <div className="m-price-name">Pack — 10 audits</div>
            <div className="m-price-amount">$40<sub>/ ten</sub></div>
            <div className="m-price-desc">
              Twenty percent off the single rate. Credits do not expire and
              are shared across team members.
            </div>
          </div>

          <div className="m-price-cell">
            <div className="m-price-name">Agent / x402</div>
            <div className="m-price-amount">$5<sub>/ call · USDC</sub></div>
            <div className="m-price-desc">
              No account, no key management. Autonomous agents pay per
              invocation in USDC on Base via the x402 protocol.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 40, display: 'flex', gap: 12 }}>
          <Link href="/forge" className="m-btn m-btn--primary">
            Run an audit
          </Link>
          <a href="#integration" className="m-btn">
            Set up the MCP server
          </a>
        </div>
      </div>
    </section>
  );
}
