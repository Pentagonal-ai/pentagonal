'use client';

import { useState } from 'react';

const CHANNELS = [
  {
    name: 'MCP Registry',
    desc: 'Official protocol registry',
    url: 'https://registry.modelcontextprotocol.io',
    icon: '⬡',
    tag: 'published',
  },
  {
    name: 'Smithery',
    desc: 'MCP marketplace',
    url: 'https://smithery.ai/servers/@achilles-safehavencalls/pentagonal',
    icon: '⚒',
  },
  {
    name: 'ClawHub',
    desc: 'Agent skill registry',
    url: 'https://clawhub.ai/skills/pentagonal',
    icon: '🐾',
    tag: 'clawhub install pentagonal',
  },
  {
    name: 'npm',
    desc: 'Node package manager',
    url: 'https://www.npmjs.com/package/pentagonal-mcp',
    icon: '⬢',
    iconColor: '#cb3837',
    tag: 'npx pentagonal-mcp',
  },
  {
    name: 'MCPMarket',
    desc: 'MCP server directory',
    url: 'https://mcpmarket.com',
    icon: '🏪',
  },
  {
    name: 'MCP.so',
    desc: 'Community MCP directory',
    url: 'https://mcp.so',
    icon: '📡',
  },
  {
    name: 'GitHub',
    desc: 'Source code',
    url: 'https://github.com/Pentagonal-ai/pentagonal',
    icon: '⚙',
  },
];

const TWEET_TEXT = `Pentagonal is live everywhere.

MCP Registry — registry.modelcontextprotocol.io
Smithery — smithery.ai/servers/@achilles-safehavencalls/pentagonal
ClawHub — clawhub.ai/skills/pentagonal
npm — npx pentagonal-mcp
GitHub — github.com/Pentagonal-ai/pentagonal

Audit smart contracts for $5. Free tools for everything else.

pentagonal.ai`;

export function AvailableOnSection() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`;

  return (
    <section className="marketing-section" id="available-on">
      <div className="marketing-section-label">Distribution</div>
      <h2 className="marketing-section-title">Available everywhere</h2>
      <p className="marketing-section-desc">
        Pentagonal is listed across every major MCP registry, skill marketplace, and package manager.
      </p>

      <div className="available-grid">
        {CHANNELS.map((ch, i) => (
          <a
            key={ch.name}
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`available-card ${hoveredIdx === i ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="available-icon" style={ch.iconColor ? { color: ch.iconColor } : undefined}>
              {ch.icon}
            </span>
            <div className="available-info">
              <div className="available-name">
                {ch.name}
                {ch.tag && <span className="available-tag">{ch.tag}</span>}
              </div>
              <div className="available-desc">{ch.desc}</div>
            </div>
            <span className="available-arrow">↗</span>
          </a>
        ))}
      </div>

      <div className="available-share-row">
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="available-share-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Share on X
        </a>
      </div>
    </section>
  );
}
