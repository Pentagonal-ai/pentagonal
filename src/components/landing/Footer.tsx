'use client';

import { PentagonMark } from '@/components/PentagonLogo';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand-name">
            <PentagonMark />
            Pentagonal
          </div>
          <p className="footer-brand-desc">
            AI-powered smart contract forge. Create, audit, and deploy — with 5 autonomous security agents watching every line.
          </p>
        </div>

        <div>
          <div className="footer-col-title">Product</div>
          <ul className="footer-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#chains">Chains</a></li>
          </ul>
        </div>

        <div>
          <div className="footer-col-title">Developers</div>
          <ul className="footer-links">
            <li><a href="https://github.com/Pentagonal-ai" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="#" onClick={(e) => e.preventDefault()}>Documentation</a></li>
            <li><a href="#" onClick={(e) => e.preventDefault()}>API</a></li>
          </ul>
        </div>

        <div>
          <div className="footer-col-title">Social</div>
          <ul className="footer-links">
            <li><a href="https://x.com/Pentagonalai" target="_blank" rel="noopener noreferrer">X / Twitter</a></li>
            <li><a href="https://github.com/Pentagonal-ai" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Pentagonal. Built on pentagonal.ai</span>
        <span>Sovereign payments. No middlemen.</span>
      </div>
    </footer>
  );
}
