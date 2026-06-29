'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { CHAINS, type Chain } from '@/app/sentinel/sentinel-ui';

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

export function QuantumHero() {
  const router = useRouter();
  const [addr, setAddr] = useState('');
  const [chain, setChain] = useState<Chain>('ethereum');

  function scan(e: React.FormEvent) {
    e.preventDefault();
    const a = addr.trim();
    if (!a) return;
    router.push(`/sentinel/${chain}/${a}`);
  }

  return (
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
      <div className="sn-hero-actions">
        <Link href="/forge" className="sn-cta primary">Build a contract</Link>
        <Link href="/forge" className="sn-cta ghost">Audit one you have</Link>
        <span className="sn-install">npx -y pentagonal-mcp</span>
      </div>
    </section>
  );
}

export function NineAttackers() {
  return (
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
  );
}

export function NinthExplainer() {
  return (
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
  );
}

// Token-holder perk — holders of >=0.25% of supply get 1 free audit/build per 24h.
const HolderQualifyTag = dynamic(
  () => import('./HolderQualifyTag').then((m) => m.HolderQualifyTag),
  { ssr: false, loading: () => <div className="sn-perk-tag">✦ Token holders</div> },
);

export function HolderPerk() {
  const TOKEN = '0x92B89BD08D7625407de0F9E746c6546d3b52d64f';
  const UNISWAP = `https://app.uniswap.org/swap?outputCurrency=${TOKEN}&chain=mainnet`;
  return (
    <section className="sn-perk">
      <div className="sn-perk-glow" aria-hidden />
      <div className="sn-perk-body">
        <HolderQualifyTag />
        <h2 className="sn-perk-h">Hold $PENT. <span className="q-text">Audit for free.</span></h2>
        <p className="sn-perk-p">
          Hold just <b>0.25% of supply</b> — <b>25,000 $PENT</b> of 10,000,000 — and every 24 hours you get
          <b> one free audit or build</b>. No credits, no card. All nine attackers, on the house.
        </p>
        <div className="sn-perk-actions">
          <Link href="/forge" className="sn-cta primary">Start a free audit</Link>
          <a className="sn-cta ghost" href={UNISWAP} target="_blank" rel="noopener noreferrer">Get $PENT ↗</a>
        </div>
        <div className="sn-perk-addr"><span>Ethereum</span> <code>{TOKEN}</code></div>
      </div>
    </section>
  );
}

// ── Home: Qcipher hero (sits at the very top) ───────────────────────────────
export function QcipherHero() {
  return (
    <section className="sn-qc">
      <div className="sn-qc-glow" aria-hidden />
      <div className="sn-qc-body">
        <div className="sn-qc-eyebrow"><span className="sn-qc-dot" /> Quantum-safe messaging · live on Base</div>
        <h2 className="sn-qc-h"><span className="q-text">Qcipher</span></h2>
        <p className="sn-qc-p">
          Encrypted wallet-to-wallet messages, written <b>on-chain</b> and sealed with a hybrid
          {' '}<b>post-quantum</b> cipher the chain rotates every block. No servers, no inboxes —
          just keys only you hold.
        </p>
        <div className="sn-qc-actions">
          <Link href="/messages" className="sn-cta primary">Open Qcipher →</Link>
          <Link href="/messages" className="sn-cta ghost">See it live</Link>
        </div>
      </div>
    </section>
  );
}

// ── Home: unified Sentinel block — eight/ninth hero + the $PENT perk in one ──
export function UnifiedHero() {
  const router = useRouter();
  const [addr, setAddr] = useState('');
  const [chain, setChain] = useState<Chain>('ethereum');
  const TOKEN = '0x92B89BD08D7625407de0F9E746c6546d3b52d64f';
  const UNISWAP = `https://app.uniswap.org/swap?outputCurrency=${TOKEN}&chain=mainnet`;

  function scan(e: React.FormEvent) {
    e.preventDefault();
    const a = addr.trim();
    if (!a) return;
    router.push(`/sentinel/${chain}/${a}`);
  }

  return (
    <section className="sn-uni">
      <div className="sn-uni-glow" aria-hidden />
      <div className="sn-uni-body">
        <div className="sn-eyebrow">Continuous smart-contract security</div>
        <h1>Eight attackers test your contract.<br /><span className="q-text">The ninth</span> <span className="sub">is already here.</span></h1>
        <p className="sn-lead">
          Every Pentagonal audit runs a team of <b>eight specialist attackers</b> against your code.
          Sentinel adds a <b>ninth no other auditor watches for</b> — <span className="q-text" style={{ fontWeight: 600 }}>quantum exposure</span> —
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
        <div className="sn-hero-actions">
          <Link href="/forge" className="sn-cta primary">Build a contract</Link>
          <Link href="/forge" className="sn-cta ghost">Audit one you have</Link>
          <span className="sn-install">npx -y pentagonal-mcp</span>
        </div>
      </div>
      <div className="sn-uni-perk">
        <div className="sn-uni-perk-left">
          <HolderQualifyTag />
          <div className="sn-uni-perk-h">Hold $PENT. <span className="q-text">Audit for free.</span></div>
          <div className="sn-uni-perk-txt">
            <b>25,000 $PENT</b> — 0.25% of supply — gets you <b>one free audit or build every 24 hours</b>.
            No credits, no card. All nine attackers, on the house.
          </div>
        </div>
        <div className="sn-uni-perk-actions">
          <Link href="/forge" className="sn-cta primary">Start a free audit</Link>
          <a className="sn-cta ghost" href={UNISWAP} target="_blank" rel="noopener noreferrer">Get $PENT ↗</a>
        </div>
      </div>
    </section>
  );
}
