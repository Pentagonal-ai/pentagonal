'use client';

import { useState } from 'react';
import { CHAINS, initial, shortAddr, type Chain } from '../sentinel-ui';

type Approval = { token: string; tokenSymbol?: string; spender: string; spenderTag?: string; amount: string; flags: string[] };
type ScanResp = { wallet?: string; chain?: string; supported?: boolean; totalApprovals?: number; risky?: Approval[]; note?: string; error?: string };

const EVM = CHAINS.filter((c) => c !== 'solana');

export default function WalletGuard() {
  const [addr, setAddr] = useState('');
  const [chain, setChain] = useState<Chain>('ethereum');
  const [scan, setScan] = useState<ScanResp | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const a = addr.trim();
    if (!a) return;
    setLoading(true); setScan(null);
    try {
      const r = await fetch('/api/wallet-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: a, chain }) });
      setScan(await r.json());
    } catch {
      setScan({ error: 'scan failed' });
    } finally { setLoading(false); }
  }

  const risky = scan?.risky ?? [];
  const count = (f: string) => risky.filter((r) => r.flags.includes(f)).length;

  return (
    <div className="sn-wrap">
      <form className="sn-scan" onSubmit={run}>
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Scan a wallet for risky approvals — paste an address…" />
        <select value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
          {EVM.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="sn-btn" type="submit">Scan</button>
      </form>

      {loading && <div className="sn-loading">Scanning approvals…</div>}
      {scan?.error && <div className="sn-err">{scan.error}</div>}

      {scan && !scan.error && (
        <>
          <div className="sn-whead">
            <div className="av">{initial(scan.wallet ?? addr)}</div>
            <div>
              <h2>{shortAddr(scan.wallet ?? addr)}</h2>
              <div className="addr">{scan.wallet ?? addr} · {scan.chain}</div>
            </div>
          </div>

          <div className="sn-summary">
            <div className="sn-scard"><div className="k">Total approvals</div><div className="v">{scan.totalApprovals ?? 0}</div></div>
            <div className="sn-scard danger"><div className="k">Risky</div><div className="v">{risky.length}</div></div>
            <div className="sn-scard"><div className="k">Unlimited</div><div className="v">{count('unlimited')}</div></div>
            <div className="sn-scard danger"><div className="k">Malicious spenders</div><div className="v">{count('malicious')}</div></div>
          </div>

          <div className="sn-apanel">
            <div className="ph">Risky approvals</div>
            {risky.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--sn-mut)' }}>✅ No risky approvals found for this wallet.</div>
            ) : risky.map((r, i) => (
              <div className={`sn-arow${r.flags.includes('malicious') ? ' bad' : ''}`} key={i}>
                <div className="sn-tok"><div className="ti">{initial(r.tokenSymbol ?? '?')}</div><div><div className="ts">{r.tokenSymbol ?? '?'}</div><div className="tn">{shortAddr(r.token)}</div></div></div>
                <div className="sn-spender">{shortAddr(r.spender)}{r.spenderTag ? ` · ${r.spenderTag}` : ''}</div>
                <div className={`sn-amt${/unlimited/i.test(r.amount) ? ' unl' : ''}`}>{r.amount}</div>
                <div className="sn-flags">{r.flags.map((f) => <span key={f} className={`sn-flag f-${f}`}>{f}</span>)}</div>
                <a className="sn-revoke" href={`https://revoke.cash/address/${scan.wallet ?? addr}`} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', display: 'block' }}>Revoke</a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
