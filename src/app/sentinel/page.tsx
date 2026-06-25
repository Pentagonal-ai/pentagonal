'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHAINS, grade, ringColor, initial, shortAddr, type Chain } from './sentinel-ui';

type Watched = { id: string; address: string; chain: string; label: string | null; last_score: number | null };

export default function SentinelHome() {
  const router = useRouter();
  const [addr, setAddr] = useState('');
  const [chain, setChain] = useState<Chain>('ethereum');
  const [watched, setWatched] = useState<Watched[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    fetch('/api/watch')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setWatched(d.watched ?? []))
      .catch((s) => { if (s === 401) setAuthed(false); })
      .finally(() => setLoading(false));
  }, []);

  function scan(e: React.FormEvent) {
    e.preventDefault();
    const a = addr.trim();
    if (!a) return;
    router.push(`/sentinel/${chain}/${a}`);
  }

  return (
    <div className="sn-wrap">
      <form className="sn-scan" onSubmit={scan}>
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Scan any contract — paste an address…" />
        <select value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
          {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="sn-btn" type="submit">Scan</button>
      </form>

      <div className="sn-h6">{authed ? `Watched · ${watched.length}` : 'Your watch list'}</div>

      {loading ? (
        <div className="sn-loading">Loading…</div>
      ) : !authed ? (
        <div className="sn-empty">Sign in to build a continuous watch list. Until then, scan any contract above.</div>
      ) : watched.length === 0 ? (
        <div className="sn-empty">No contracts watched yet. Scan one above, then add it to your watch list.</div>
      ) : (
        <div className="sn-grid">
          {watched.map((w) => {
            const score = w.last_score ?? 0;
            const g = grade(score);
            const name = w.label || shortAddr(w.address);
            return (
              <Link key={w.id} href={`/sentinel/${w.chain}/${w.address}`} className="sn-gc" data-g={g}>
                <div className="h">
                  <div className="sn-av">{initial(name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm"><span className="t">{name}</span></div>
                    <div className="ch">{w.chain}</div>
                  </div>
                </div>
                <div className="mid">
                  <div className="sn-ring" style={{ ['--pct' as string]: score, ['--rc' as string]: ringColor(g) }}>
                    <div className="in">{w.last_score ?? '—'}</div>
                  </div>
                  <div className="meta"><div className="gr">{g.toUpperCase()}</div></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
