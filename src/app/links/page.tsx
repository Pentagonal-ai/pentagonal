import type { Metadata } from 'next';
import Link from 'next/link';
import '../marketing.css';
import { PentagonMark, ArrowRightIcon } from '@/components/landing/Icons';
import { InstallChip } from '@/components/landing/InstallChip';

export const metadata: Metadata = {
  title: 'Pentagonal — Links',
  description: 'Adversarial smart contract review. Eight attackers, one report, every contract. Find Pentagonal across registries, GitHub, and X.',
  openGraph: {
    title: 'Pentagonal — Links',
    description: 'Eight attackers, one report, every contract. All Pentagonal links in one place.',
    url: 'https://pentagonal.ai/links',
    siteName: 'Pentagonal',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pentagonal — Links',
    description: 'Eight attackers, one report, every contract.',
  },
  alternates: { canonical: 'https://pentagonal.ai/links' },
};

type LinkItem = {
  label: string;
  href: string;
  meta?: string;
  external?: boolean;
};

const PRIMARY: LinkItem[] = [
  { label: 'Run an audit',          href: '/forge',        meta: 'The forge · $5 per contract' },
  { label: 'Read the methodology',  href: '/methodology',  meta: 'How the eight attackers work' },
];

const SAMPLES: LinkItem[] = [
  { label: 'Sample audit — humans',   href: '/sample-audit-report-human.md', meta: 'Narrative · markdown',  external: true },
  { label: 'Sample audit — agents',   href: '/sample-audit-report.md',       meta: 'Structured · markdown', external: true },
  { label: 'Four.meme template audit', href: '/four-meme-template-audit.pdf', meta: 'Cached · PDF',          external: true },
  { label: 'Flap template audit',      href: '/flap-template-audit.pdf',      meta: 'Cached · PDF',          external: true },
];

const REGISTRIES: LinkItem[] = [
  { label: 'MCP Registry', href: 'https://registry.modelcontextprotocol.io',                          meta: 'Official', external: true },
  { label: 'Smithery',     href: 'https://smithery.ai/servers/@achilles-safehavencalls/pentagonal',   meta: 'MCP marketplace', external: true },
  { label: 'Glama',        href: 'https://glama.ai/mcp/servers/pentagonal',                          meta: '100% security score', external: true },
  { label: 'npm',          href: 'https://www.npmjs.com/package/pentagonal-mcp',                      meta: 'pentagonal-mcp · v1.0.2', external: true },
  { label: 'GitHub',       href: 'https://github.com/Pentagonal-ai/pentagonal',                       meta: 'Source', external: true },
  { label: 'ClawHub',      href: 'https://clawhub.ai/skills/pentagonal',                              meta: 'Skills directory', external: true },
];

const SOCIAL: LinkItem[] = [
  { label: 'X (Twitter)', href: 'https://x.com/Pentagonalai', meta: '@Pentagonalai', external: true },
];

function Row({ item }: { item: LinkItem }) {
  const inner = (
    <>
      <div className="lnk-row-text">
        <span className="lnk-row-label">{item.label}</span>
        {item.meta && <span className="lnk-row-meta">{item.meta}</span>}
      </div>
      <ArrowRightIcon className="lnk-row-arrow" />
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="lnk-row">
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} className="lnk-row">
      {inner}
    </Link>
  );
}

export default function LinksPage() {
  return (
    <div data-marketing="true">
      <main className="lnk-shell">

        {/* Brand head */}
        <header className="lnk-head">
          <PentagonMark className="lnk-mark" />
          <h1 className="lnk-wordmark">Pentagonal</h1>
          <p className="lnk-eyebrow">Adversarial smart contract review</p>
          <p className="lnk-tagline">
            Eight attackers, <em>one report,</em> every contract.
          </p>
        </header>

        {/* Install */}
        <div className="lnk-install-row">
          <InstallChip command="npx -y pentagonal-mcp" />
        </div>

        {/* Primary actions */}
        <section className="lnk-group">
          {PRIMARY.map(i => <Row key={i.href} item={i} />)}
        </section>

        {/* Sample artifacts */}
        <section className="lnk-group">
          <div className="lnk-group-label">Sample reports</div>
          {SAMPLES.map(i => <Row key={i.href} item={i} />)}
        </section>

        {/* Registries */}
        <section className="lnk-group">
          <div className="lnk-group-label">Listed on</div>
          {REGISTRIES.map(i => <Row key={i.href} item={i} />)}
        </section>

        {/* Social */}
        <section className="lnk-group">
          <div className="lnk-group-label">Follow</div>
          {SOCIAL.map(i => <Row key={i.href} item={i} />)}
        </section>

        {/* Pricing line + main site */}
        <footer className="lnk-foot">
          <div className="lnk-foot-pricing">Audits $5. Free tools for everything else.</div>
          <Link href="/" className="lnk-foot-home">pentagonal.ai →</Link>
        </footer>

      </main>

      <style>{`
        [data-marketing] .lnk-shell {
          max-width: 480px;
          margin: 0 auto;
          padding: 48px 20px 64px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        @media (min-width: 720px) {
          [data-marketing] .lnk-shell { padding: 80px 20px 96px; }
        }

        /* Brand head */
        [data-marketing] .lnk-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        [data-marketing] .lnk-mark {
          width: 56px !important;
          height: 56px !important;
          color: var(--m-fg);
        }
        [data-marketing] .lnk-wordmark {
          font-family: var(--m-font-display);
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.025em;
          margin: 0;
          font-variation-settings: 'opsz' 96;
        }
        [data-marketing] .lnk-eyebrow {
          font-family: var(--m-font-sans);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--m-accent);
          margin: 0;
        }
        [data-marketing] .lnk-tagline {
          font-family: var(--m-font-display);
          font-size: 22px;
          font-weight: 300;
          font-variation-settings: 'opsz' 36;
          line-height: 1.25;
          letter-spacing: -0.015em;
          color: var(--m-fg);
          margin: 8px 0 0;
        }
        [data-marketing] .lnk-tagline em {
          font-style: italic;
          color: var(--m-accent);
        }

        /* Install chip row — centered */
        [data-marketing] .lnk-install-row {
          display: flex;
          justify-content: center;
          margin: 4px 0 12px;
        }

        /* Link groups */
        [data-marketing] .lnk-group {
          display: flex;
          flex-direction: column;
          gap: 0;
          border: 1px solid var(--m-border);
          border-radius: var(--m-radius-lg);
          background: var(--m-surface);
          overflow: hidden;
        }
        [data-marketing] .lnk-group-label {
          font-family: var(--m-font-sans);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--m-fg-subtle);
          padding: 14px 18px 10px;
          border-bottom: 1px solid var(--m-border);
          background: var(--m-surface-sunken);
        }

        /* Individual link row */
        [data-marketing] .lnk-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
          color: var(--m-fg);
          text-decoration: none;
          border-bottom: 1px solid var(--m-border);
          transition: background 0.15s;
        }
        [data-marketing] .lnk-row:last-child { border-bottom: none; }
        [data-marketing] .lnk-row:hover { background: var(--m-surface-sunken); }
        [data-marketing] .lnk-row:hover .lnk-row-arrow { transform: translateX(3px); color: var(--m-fg); }

        [data-marketing] .lnk-row-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }
        [data-marketing] .lnk-row-label {
          font-family: var(--m-font-sans);
          font-size: 15px;
          font-weight: 500;
          color: var(--m-fg);
          letter-spacing: -0.005em;
        }
        [data-marketing] .lnk-row-meta {
          font-family: var(--m-font-mono);
          font-size: 11.5px;
          color: var(--m-fg-muted);
          letter-spacing: 0.02em;
        }
        [data-marketing] .lnk-row-arrow {
          color: var(--m-fg-subtle);
          flex-shrink: 0;
          transition: transform 0.15s, color 0.15s;
        }

        /* Footer */
        [data-marketing] .lnk-foot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-top: 16px;
          margin-top: 8px;
          border-top: 1px solid var(--m-border);
          text-align: center;
        }
        [data-marketing] .lnk-foot-pricing {
          font-family: var(--m-font-sans);
          font-size: 13px;
          color: var(--m-fg-muted);
        }
        [data-marketing] .lnk-foot-home {
          font-family: var(--m-font-mono);
          font-size: 12px;
          color: var(--m-fg);
          text-decoration: none;
          border-bottom: 1px solid var(--m-border-strong);
          padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        [data-marketing] .lnk-foot-home:hover { border-color: var(--m-fg); }
      `}</style>
    </div>
  );
}
