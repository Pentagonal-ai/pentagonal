// Pentagonal Sentinel — Pentagon Score endpoint (Chunk 1)
// POST { address, chain, audit? } -> transparent 0..100 risk score + factor breakdown.
// Persists each score to risk_scores (shared-intel table, service-role write).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecurityIntel } from '@/lib/score/intel';
import { computeScore, type AuditCounts } from '@/lib/score/score';

const SUPPORTED = new Set([
  'ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'solana',
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      address?: string; chain?: string; audit?: AuditCounts; quantumExposed?: boolean;
    };
    const address = body.address?.trim();
    const chain = body.chain?.trim().toLowerCase();

    if (!address || !chain) {
      return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    }
    if (!SUPPORTED.has(chain)) {
      return NextResponse.json({ error: `unsupported chain: ${chain}` }, { status: 400 });
    }

    const intel = await getSecurityIntel(address, chain);
    const result = computeScore(intel, { audit: body.audit, quantumExposed: body.quantumExposed });

    // Persist (best-effort — a failed write must not fail the request).
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      await admin.from('risk_scores').insert({
        address: chain === 'solana' ? address : address.toLowerCase(),
        chain,
        score: result.score,
        factors: { grade: result.grade, fatal: result.fatal, factors: result.factors, source: intel.source, signals: result.signals },
      });
    } catch (e) {
      console.error('[score] persist failed:', e);
    }

    return NextResponse.json({
      address,
      chain,
      score: result.score,
      grade: result.grade,
      fatal: result.fatal,
      source: intel.source,
      factors: result.factors,
      signals: result.signals,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'score failed' },
      { status: 500 },
    );
  }
}
