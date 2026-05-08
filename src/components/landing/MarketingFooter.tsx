import Link from 'next/link';
import { PentagonMark } from './Icons';

export function MarketingFooter() {
  return (
    <footer className="m-footer">
      <div className="m-container">
        <div className="m-footer-grid">
          <div className="m-footer-col">
            <Link href="/" className="m-logo" aria-label="Pentagonal home">
              <PentagonMark />
              <span>Pentagonal</span>
            </Link>
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--m-fg-muted)', maxWidth: 320, lineHeight: 1.6 }}>
              Adversarial smart contract review, automated. Eight attackers,
              fourteen networks, one report.
            </p>
          </div>

          <div className="m-footer-col">
            <h4>Product</h4>
            <ul>
              <li><Link href="/forge">Forge</Link></li>
              <li><a href="#build">Build</a></li>
              <li><a href="#adversaries">Adversaries</a></li>
              <li><Link href="/methodology">Methodology</Link></li>
              <li><a href="/sample-audit-report-human.md" target="_blank" rel="noreferrer">Sample report (human)</a></li>
              <li><a href="/sample-audit-report.md" target="_blank" rel="noreferrer">Sample report (agent)</a></li>
              <li><a href="#coverage">Coverage</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>

          <div className="m-footer-col">
            <h4>Integrate</h4>
            <ul>
              <li><a href="#integration">MCP server</a></li>
              <li><a href="https://www.npmjs.com/package/pentagonal-mcp" target="_blank" rel="noreferrer">npm</a></li>
              <li><a href="https://glama.ai/mcp/servers/pentagonal" target="_blank" rel="noreferrer">Glama</a></li>
            </ul>
          </div>

          <div className="m-footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="https://x.com/Pentagonalai" target="_blank" rel="noreferrer">X / Twitter</a></li>
              <li><Link href="/login">Sign in</Link></li>
            </ul>
          </div>
        </div>

        <div className="m-footer-meta">
          <span>© {new Date().getFullYear()} Pentagonal. All rights reserved.</span>
          <span>Made for engineers who would rather not be exploited.</span>
        </div>
      </div>
    </footer>
  );
}
