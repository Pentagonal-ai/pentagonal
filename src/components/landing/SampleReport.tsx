import { ArrowRightIcon } from './Icons';

export function SampleReport() {
  return (
    <section className="m-section" id="report">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Output</span>
          <h2 className="m-h2">
            After eight attackers,
            one report you can hand to a fund.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Markdown by default, PDF on export. Each finding includes the
            exploit narrative, the offending code segment with line numbers,
            a severity graded by attack cost, and a remediation diff.
          </p>
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/sample-audit-report-human.md" target="_blank" rel="noreferrer" className="m-btn m-btn--primary">
              Sample report — for humans
              <ArrowRightIcon className="m-btn-arrow" />
            </a>
            <a href="/sample-audit-report.md" target="_blank" rel="noreferrer" className="m-btn">
              Sample report — for AI agents
            </a>
          </div>
          <p className="m-meta" style={{ marginTop: 12, fontSize: 12.5 }}>
            The agent format is what an autonomous client receives over x402 — the
            exact output of <code>generateReportMarkdown()</code>. The human format is
            the same audit, restated as narrative for technical reviewers and fund
            partners.
          </p>
        </div>

        <article className="m-report" aria-label="Sample report">
          <div className="m-report-doc">
            <div className="m-report-doc-meta">
              <span>Pentagonal · Audit Report</span>
              <span>Rev. 14 · 2026-04-22</span>
            </div>
            <h3 className="m-report-doc-title">
              Sentinel Vault — staking module
            </h3>
            <div className="m-report-doc-subtitle">
              Solidity 0.8.24 · Base mainnet · 412 LoC · 1 contract, 3 libraries
            </div>
            <p className="m-report-doc-summary">
              The module implements a single-asset staking vault with
              time-weighted rewards. The red team broke it in eleven places,
              three of them critical: a reentrancy vector in
              <em> withdraw</em>, a rounding asymmetry that lets an early
              depositor inflate share price via direct token donation, and a
              missing oracle staleness check in the reward-rate setter. A
              consolidated remediation patch is appended.
            </p>
          </div>

          <aside className="m-report-stats">
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">Findings</span>
              <span className="m-report-stat-value">11</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">
                <span className="m-dot" style={{ color: 'var(--m-sev-critical)' }} />
                Critical
              </span>
              <span className="m-report-stat-value m-report-stat-value--critical">3</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">
                <span className="m-dot" style={{ color: 'var(--m-sev-high)' }} />
                High
              </span>
              <span className="m-report-stat-value m-report-stat-value--high">2</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">
                <span className="m-dot" style={{ color: 'var(--m-sev-medium)' }} />
                Medium
              </span>
              <span className="m-report-stat-value m-report-stat-value--medium">4</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">
                <span className="m-dot" style={{ color: 'var(--m-sev-low)' }} />
                Low / Informational
              </span>
              <span className="m-report-stat-value m-report-stat-value--low">2</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">Security score</span>
              <span className="m-report-stat-value">61 / 100</span>
            </div>
            <div className="m-report-stat-row">
              <span className="m-report-stat-label">Rules applied</span>
              <span className="m-report-stat-value">2,184</span>
            </div>
          </aside>
        </article>
      </div>
    </section>
  );
}
