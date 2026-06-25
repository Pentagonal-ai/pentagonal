'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHAINS, grade, ringColor, initial, shortAddr, type Chain } from './sentinel-ui';

type Watched = { id: string; address: string; chain: string; label: string | null; last_score: number | null };

const ATTACKERS = [
  { n: '01', nm: 'Reentrancy', ds: 'Re-enters before state settles — the classic drain.' },
  { n: '02', nm: 'Flash-Loan', ds: 'Uncollateralized capital to bend prices in one block.' },
  { n: '03', nm: 'Access Control', ds: 'Missing or broken permission gates on critical paths.' },
  { n: '04', nm: 'Oracle Manipulation', ds: 'Poisoned price feeds and stale data dependencies.' },
  { n: '05', nm: 'Front-Running / MEV', ds: 'Ordering games, sandwiches, and value extraction.' },
  { n: '06', nm: 'Integer Overflow', ds: 'Arithmetic edges that wrap balances and supply.' },
  { n: '07', nm: 'Economic Exploit', ds: 'Incentive and tokenomic attacks on the design itself.' },
  { n: '08', nm: 'Gas Griefing', ds: 'Forcing failure or cost through gas-level abuse.' },
];

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
      {/* ── quantum-forward hero ── */}
      <section className="sn-hero">
        <div className="sn-eyebrow">Continuous smart-contract security</div>
        <h1>Eight attackers test your contract.<br /><span className="q-text">The ninth</span> <span className="sub">is already here.</span></h1>
        <p className="sn-lead">
          Every Pentagonal audit runs a team of <b>eight specialist attackers</b> against your code.
          Sentinel adds a <b>ninth that no other auditor watches for</b> — <span className="q-text" style={{ fontWeight: 600 }}>quantum exposure</span> —
          and keeps all nine running, continuously, on every contract and wallet you track.
        </p>
        <form className="sn-scan" onSubmit={scan}>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Run all nine against any contract — paste an address…" />
          <select value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
            {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="sn-btn" type="submit">Scan</button>
        </form>
        <div className="sn-scanhint">No login needed to scan. Add a contract to your watch list for continuous monitoring + alerts.</div>
      </section>

      {/* ── watch list ── */}
      <section className="sn-sec">
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
      </section>

      {/* ── the nine attackers ── */}
      <section className="sn-sec">
        <div className="sn-kicker">The attack surface</div>
        <h2>The Nine Attackers</h2>
        <div className="sn-sh">Classic audits stop at eight. Each finding feeds the Pentagon Score — and the ninth feeds the one nobody else is scoring for yet.</div>
        <div className="sn-nine">
          {ATTACKERS.map((a) => (
            <div className="sn-atk" key={a.n}>
              <span className="n">{a.n}</span>
              <div><div className="nm">{a.nm}</div><div className="ds">{a.ds}</div></div>
            </div>
          ))}
          <div className="sn-atk q">
            <span className="n">09</span>
            <div>
              <div className="nm">⚛ Quantum <span className="badge">the 9th attacker</span></div>
              <div className="ds">The one that isn&apos;t here yet — but is already harvesting. Sentinel flags it while you still have time to move.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── the 9th parameter explained ── */}
      <section className="sn-sec">
        <div className="sn-qx">
          <div className="atom">⚛</div>
          <h3>The 9th parameter · explained</h3>
          <h4>Why quantum is on the board</h4>
          <p>
            Almost every contract secures ownership and approvals with <b>ECDSA over secp256k1</b> — the math behind{' '}
            <span className="hl mono">ecrecover</span>, <span className="hl mono">EIP-2612 permit</span>, and <span className="hl mono">EIP-1271</span> signatures.
            A sufficiently large quantum computer breaks that math and can forge those signatures.
          </p>
          <p>
            The attack has <b>already started</b>. Adversaries record signed transactions today and store them to break later —{' '}
            <span className="hl">&ldquo;harvest now, decrypt later.&rdquo;</span> The signature you broadcast this year is the one they crack the year the hardware arrives.
          </p>
          <p>
            Sentinel reads your <b>verified source</b> and flags every quantum-vulnerable primitive it finds — so you can plan a migration to
            post-quantum schemes <b>while there&apos;s still time</b>, not after.
          </p>
          <div className="detect">
            <span className="chip">secp256k1 (ecrecover)</span>
            <span className="chip">EIP-2612 permit</span>
            <span className="chip">EIP-1271</span>
            <span className="chip">ECDSA recovery</span>
            <span className="chip">BN254 pairings</span>
          </div>
          <div className="honest">
            <b>Honest by design.</b> This is <b>forward risk</b> — not exploitable today, and we never claim a contract is &ldquo;quantum-proof.&rdquo;
            Contracts that rely on keccak256 hashing aren&apos;t flagged; that&apos;s quantum-resistant. We sell <b>foresight</b>, not fear.
          </div>
        </div>
      </section>
    </div>
  );
}
