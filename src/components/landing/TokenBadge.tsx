'use client';

import { useEffect, useState } from 'react';

type Stats = {
  symbol: string;
  priceUsd: number | null;
  change24h: number | null;
  marketCap: number | null;
  url: string;
};

function fmtPrice(p: number): string {
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(2)}`;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

// Live $PENT price chip — rendered in the marketing header so it's always visible.
export function TokenBadge() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let on = true;
    const load = () =>
      fetch('/api/pent')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (on && d && !d.error) setS(d as Stats); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { on = false; clearInterval(t); };
  }, []);

  if (!s || s.priceUsd == null) return null;

  return (
    <a
      className="m-token"
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View $${s.symbol} on DexScreener`}
    >
      <span className="m-token-tk">${s.symbol}</span>
      <span className="m-token-px">{fmtPrice(s.priceUsd)}</span>
      {s.marketCap != null && (
        <span className="m-token-mc">MC {fmtCompact(s.marketCap)}</span>
      )}
    </a>
  );
}
