// Pentagonal Sentinel — monitoring tick (Chunk 4)
// Cron-driven pass: re-score each active watched contract, diff against the last
// stored score/signals, and raise alerts on drift. Triggered by Vercel Cron (GET,
// guarded by CRON_SECRET) or manually with the same bearer.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecurityIntel, type SecurityIntel } from '@/lib/score/intel';
import { computeScore } from '@/lib/score/score';
import { createAlert } from '@/lib/alerts/create';

const BATCH = 25; // contracts re-scored per tick
const SCORE_DROP = 8; // points; a drop >= this raises an alert

type WatchRow = { id: string; user_id: string | null; address: string; chain: string; last_score: number | null };
type PrevScore = { score: number; factors: { signals?: SecurityIntel } | null };

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience; set CRON_SECRET in prod (Vercel sends it)
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'forbidden' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: watched, error } = await admin
    .from('watched_contracts')
    .select('id, user_id, address, chain, last_score')
    .eq('status', 'active')
    .order('updated_at', { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { address: string; chain: string; score: number; alerts: string[] }[] = [];

  for (const w of (watched ?? []) as WatchRow[]) {
    try {
      const intel = await getSecurityIntel(w.address, w.chain);
      const result = computeScore(intel);
      const alerts: string[] = [];

      // Previous snapshot (most recent before this pass).
      const { data: prevRows } = await admin
        .from('risk_scores')
        .select('score, factors')
        .eq('address', w.address)
        .eq('chain', w.chain)
        .order('computed_at', { ascending: false })
        .limit(1);
      const prev = prevRows?.[0] as PrevScore | undefined;
      const prevSignals = prev?.factors?.signals;
      const prevScore = prev?.score ?? w.last_score ?? null;

      // Detect: newly fatal (honeypot / rug / cannot-sell).
      const wasFatal = Boolean(prevSignals?.isHoneypot || prevSignals?.rugged || prevSignals?.cannotSell);
      if (result.fatal && prevSignals && !wasFatal) {
        await createAlert({
          type: 'new_critical_finding', severity: 'critical', address: w.address, chain: w.chain,
          userId: w.user_id ?? undefined, watchedContractId: w.id,
          payload: { title: 'Contract became fatal', message: 'Now flagged as honeypot / non-sellable / rugged.', score: result.score },
        });
        alerts.push('became_fatal');
      }

      // Detect: meaningful score drop.
      if (prevScore != null && result.score <= prevScore - SCORE_DROP) {
        await createAlert({
          type: 'score_drop', severity: result.score < 40 ? 'high' : 'medium', address: w.address, chain: w.chain,
          userId: w.user_id ?? undefined, watchedContractId: w.id,
          payload: { title: 'Pentagon Score dropped', message: `Score fell ${prevScore} -> ${result.score}.`, score: result.score, prevScore },
        });
        alerts.push('score_drop');
      }

      // Persist new snapshot + update the watch row.
      await admin.from('risk_scores').insert({
        address: w.address, chain: w.chain, score: result.score,
        factors: { grade: result.grade, fatal: result.fatal, factors: result.factors, source: intel.source, signals: result.signals },
      });
      await admin.from('watched_contracts').update({ last_score: result.score, updated_at: new Date().toISOString() }).eq('id', w.id);

      results.push({ address: w.address, chain: w.chain, score: result.score, alerts });
    } catch (e) {
      console.error('[sentinel] tick error for', w.address, e);
    }
  }

  return NextResponse.json({ checked: results.length, alerts: results.reduce((s, r) => s + r.alerts.length, 0), results });
}
