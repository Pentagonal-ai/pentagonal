import { ArrowRightIcon } from './Icons';

type Listing = {
  name: string;
  href: string;
  stat?: string;
  blurb: string;
};

const PRIMARY: Listing[] = [
  {
    name: 'Glama',
    href: 'https://glama.ai/mcp/servers/pentagonal',
    stat: '100% security score',
    blurb: 'Independent registry of audited MCP servers. Listed and rated.',
  },
  {
    name: 'npm',
    href: 'https://www.npmjs.com/package/pentagonal-mcp',
    stat: 'pentagonal-mcp · v1.0.2',
    blurb: 'Public package. Install with npx, no signup.',
  },
  {
    name: 'Smithery',
    href: 'https://smithery.ai/servers/@achilles-safehavencalls/pentagonal',
    stat: 'MCP marketplace',
    blurb: 'One-click install into Claude Desktop, Cursor, Windsurf.',
  },
  {
    name: 'ClawHub',
    href: 'https://clawhub.ai/skills/pentagonal',
    stat: 'Skills directory',
    blurb: 'Drop-in skill package for any MCP-compatible client.',
  },
];

const LAUNCHPADS: Listing[] = [
  {
    name: 'Four.meme',
    href: 'https://four.meme',
    stat: 'BNB Chain · template pre-audited',
    blurb: 'Detected on paste. Tokens skip the audit queue and serve a cached template review with live bonding-curve progress.',
  },
  {
    name: 'Flap',
    href: 'https://flap.sh',
    stat: 'BNB Chain · template pre-audited',
    blurb: 'Tax-token launchpad with vault-attached tokens. Detected on paste. Cached template audit covers asymmetric tax + vault trust surface.',
  },
];

export function Listed() {
  return (
    <section className="m-section" id="listed">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Available on</span>
          <h2 className="m-h2">
            Distributed where engineers
            and agents look for tools.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Pentagonal is published to every major MCP registry and
            skill directory. Independent reviewers list it; agents
            discover it without a human in the loop.
          </p>
        </div>

        <div className="m-listed-grid">
          {PRIMARY.map(l => (
            <a key={l.name} className="m-listed-card" href={l.href} target="_blank" rel="noreferrer">
              <div className="m-listed-card-head">
                <span className="m-listed-card-name">{l.name}</span>
                <ArrowRightIcon className="m-listed-card-arrow" />
              </div>
              {l.stat && <div className="m-listed-card-stat">{l.stat}</div>}
              <div className="m-listed-card-blurb">{l.blurb}</div>
            </a>
          ))}
        </div>

        <div className="m-prose" style={{ marginTop: 64 }}>
          <span className="m-eyebrow">Launchpad coverage</span>
          <h3 className="m-h3" style={{ marginTop: 16, fontSize: 22 }}>
            Tokens from known launchpads skip the audit queue.
          </h3>
          <p className="m-meta" style={{ marginTop: 12, fontSize: 14, color: 'var(--m-fg-muted)' }}>
            Some launchpads deploy every token from a single template.
            Pentagonal recognises these on paste and serves a cached
            template audit instead of charging for a re-run.
          </p>
        </div>

        <div className="m-listed-grid" style={{ marginTop: 24 }}>
          {LAUNCHPADS.map(l => (
            <a key={l.name} className="m-listed-card" href={l.href} target="_blank" rel="noreferrer">
              <div className="m-listed-card-head">
                <span className="m-listed-card-name">{l.name}</span>
                <ArrowRightIcon className="m-listed-card-arrow" />
              </div>
              {l.stat && <div className="m-listed-card-stat">{l.stat}</div>}
              <div className="m-listed-card-blurb">{l.blurb}</div>
            </a>
          ))}
        </div>

        <div className="m-listed-foot">
          <a href="https://www.pentagonal.ai/api/mcp" className="m-listed-foot-link">
            <span>HTTP MCP endpoint</span>
            <span className="m-listed-foot-handle">pentagonal.ai/api/mcp</span>
            <ArrowRightIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
