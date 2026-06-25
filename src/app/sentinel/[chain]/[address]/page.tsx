'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { grade, ringColor, gradeLabel, shortAddr } from '../../sentinel-ui';

type Factor = { label: string; penalty: number; detail: string };
type ScoreResp = { score?: number; grade?: string; fatal?: boolean; source?: string; factors?: Factor[]; error?: string };
type QFinding = { title: string; recommendation: string };
type QuantumResp = { exposed?: boolean; severity?: string; primitives?: string[]; findings?: QFinding[]; note?: string; error?: string };
type Match = { name: string; severity: string; matchedOn: string };
type ForecastResp = { flagged?: boolean; imminence?: string; matches?: Match[]; note?: string; error?: string };

export default function SentinelDetail() {
  const params = useParams<{ chain: string; address: string }>();
  const chain = decodeURIComponent(params.chain);
  const address = decodeURIComponent(params.address);

  const [score, setScore] = useState<ScoreResp | null>(null);
  const [quantum, setQuantum] = useState<QuantumResp | null>(null);
  const [forecast, setForecast] = useState<ForecastResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sentinel/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, chain }) })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setScore({ error: d.error }); return; }
        setScore(d.score);
        setQuantum(d.quantum);
        setForecast(d.forecast);
      })
      .catch(() => setScore({ error: 'analyze failed' }))
      .finally(() => setLoading(false));
  }, [address, chain]);

  const sc = score?.score ?? 0;
  const g = grade(sc);
  const verified = !loading && !score?.error && sc >= 85 && !score?.fatal;
  const imm = forecast?.imminence ?? 'none';
  const immPct = imm === 'high' ? 85 : imm === 'medium' ? 55 : imm === 'low' ? 25 : 4;

  return (
    <div className="sn-wrap">
      <Link href="/sentinel" className="sn-back">← back to watch list</Link>

      <div className="sn-dhead">
        <div>
          <h2>{shortAddr(address)}<span className="sn-chainbadge">{chain}</span></h2>
          <div className="addr">{address}</div>
        </div>
        {verified && <span className="sn-verified">Pentagon-Verified</span>}
      </div>

      {loading ? (
        <div className="sn-loading">Scanning all nine attackers…</div>
      ) : score?.error ? (
        <div className="sn-err">Couldn&apos;t score this contract: {score.error}</div>
      ) : (
        <>
          <div className="sn-focus">
            {/* score */}
            <div>
              <div className="sn-ring sn-bigring" style={{ ['--pct' as string]: sc, ['--rc' as string]: ringColor(g) }}>
                <div className="in"><span className="n">{sc}</span><span className="g">{g.toUpperCase()} · {gradeLabel(g)}</span></div>
              </div>
              <div className="sn-ffac">
                {(score?.factors ?? []).length === 0 ? (
                  <div className="r"><span className="l">No penalties — clean signals</span><span className="p ok">ok</span></div>
                ) : (
                  (score?.factors ?? []).map((f, i) => (
                    <div className="r" key={i}>
                      <span className="l">{f.label} · {f.detail}</span>
                      <span className={`p${f.penalty === 0 ? ' ok' : ''}`}>{f.penalty === 0 ? 'ok' : `−${f.penalty}`}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* quantum */}
            <div className="sn-qbox">
              <h3>Quantum exposure · the 9th attacker</h3>
              {quantum?.exposed ? (
                <>
                  <span className="sn-qst ex">⚛ EXPOSED · {quantum.severity}</span>
                  <div className="sn-qch">{(quantum.primitives ?? []).map((p) => <span className="sn-qchip" key={p}>{p}</span>)}</div>
                  {(quantum.findings ?? []).map((f, i) => (
                    <div className="sn-qf" key={i}><span className="t">{f.title}</span><br />→ {f.recommendation}</div>
                  ))}
                  <div className="sn-qnote">Forward risk, not exploitable today — flagged while there&apos;s still time to move. Harvest now, decrypt later.</div>
                </>
              ) : (
                <>
                  <span className="sn-qst cl">✓ no quantum-vulnerable primitives</span>
                  <div className="sn-qnote" style={{ marginTop: 14 }}>{quantum?.note ?? 'Relies on keccak256 hashing, which is quantum-resistant. Forward-looking analytics, not “quantum-proof.”'}</div>
                </>
              )}
            </div>
          </div>

          {/* forecast */}
          <div className="sn-panel">
            <h3>Exploit forecast</h3>
            {forecast?.flagged ? (
              <>
                <div className="sn-imm">
                  <span className="lab" style={{ color: imm === 'high' ? 'var(--sn-red)' : 'var(--sn-yellow)' }}>Imminence: {imm}</span>
                  <div className="meter"><i style={{ width: `${immPct}%` }} /></div>
                </div>
                {(forecast.matches ?? []).map((m, i) => (
                  <div className="sn-sig" key={i}>
                    <span className={`sev sev-${m.severity}`}>{m.severity.slice(0, 3).toUpperCase()}</span>
                    <div><div>{m.name}</div><div className="sd">matched <span className="mono">{m.matchedOn}</span></div></div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: 'var(--sn-mut)', fontSize: 13 }}>{forecast?.note ?? 'No known pre-exploit patterns matched.'}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
