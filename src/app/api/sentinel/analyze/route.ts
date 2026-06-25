// Pentagonal Sentinel — combined analyze endpoint (UI)
// POST { address, chain } -> { score, quantum, forecast } in ONE call, fetching the
// verified source only once (avoids the duplicate Etherscan fetch / rate-limit race
// when the dashboard would otherwise call score + quantum + forecast separately).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecurityIntel } from '@/lib/score/intel';
import { computeScore } from '@/lib/score/score';
import { analyzeQuantumExposure, fetchVerifiedSource } from '@/lib/quantum/scan';
import { getSignatures, seedBaseline } from '@/lib/sentinel/signatures';
import { forecast } from '@/lib/sentinel/forecast';

const SUPPORTED = new Set(['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'solana']);
const EVM = new Set(['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { address?: string; chain?: string };
    const address = body.address?.trim();
    const chain = body.chain?.trim().toLowerCase();
    if (!address || !chain) return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    if (!SUPPORTED.has(chain)) return NextResponse.json({ error: `unsupported chain: ${chain}` }, { status: 400 });

    // Fetch source ONCE (EVM); quantum + forecast both reuse it.
    const source = EVM.has(chain) ? await fetchVerifiedSource(address, chain) : null;

    const quantum = source
      ? analyzeQuantumExposure(source)
      : { exposed: false, severity: 'none' as const, primitives: [], findings: [], note: 'No verified source available — cannot analyze cryptographic primitives.' };

    const intel = await getSecurityIntel(address, chain);
    const score = computeScore(intel, { quantumExposed: quantum.exposed });

    await seedBaseline();
    const sigs = await getSignatures();
    const fc = source
      ? forecast(source, sigs)
      : { flagged: false, imminence: 'none' as const, matches: [], note: 'No verified source available to forecast against.' };

    // Persist (best-effort).
    try {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await admin.from('risk_scores').insert({
        address: chain === 'solana' ? address : address.toLowerCase(), chain, score: score.score,
        factors: { grade: score.grade, fatal: score.fatal, factors: score.factors, source: intel.source, signals: score.signals },
      });
    } catch (e) { console.error('[analyze] persist failed:', e); }

    return NextResponse.json({
      address, chain,
      score: { score: score.score, grade: score.grade, fatal: score.fatal, source: intel.source, factors: score.factors },
      quantum,
      forecast: { ...fc, signaturesChecked: sigs.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'analyze failed' }, { status: 500 });
  }
}
