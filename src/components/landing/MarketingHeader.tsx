import Link from 'next/link';
import { PentagonMark } from './Icons';

export function MarketingHeader() {
  return (
    <header className="m-header">
      <div className="m-container m-header-inner">
        <Link href="/" className="m-logo" aria-label="Pentagonal home">
          <PentagonMark />
          <span>Pentagonal</span>
        </Link>
        <nav className="m-nav" aria-label="Primary">
          <a href="#build" className="m-nav-link">Build</a>
          <a href="#adversaries" className="m-nav-link">Adversaries</a>
          <a href="#coverage" className="m-nav-link">Coverage</a>
          <a href="#integration" className="m-nav-link">Integration</a>
          <a href="#pricing" className="m-nav-link">Pricing</a>
          <a href="#listed" className="m-nav-link">Listed on</a>
          <Link href="/forge" className="m-btn m-btn--primary">
            Open the forge
          </Link>
        </nav>
      </div>
    </header>
  );
}
