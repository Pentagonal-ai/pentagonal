// Pentagonal Sentinel — exploit forecasting endpoint (Chunk 7)
// POST { address, chain, source? } -> matches against accumulated exploit signatures.

import { NextRequest, NextResponse } from 'next/server';
import { fetchVerifiedSource } from '@/lib/quantum/scan';
import { getSignatures, seedBaseline } from '@/lib/sentinel/signatures';
import { forecast } from '@/lib/sentinel/forecast';

const EVM = new Set(['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { address?: string; chain?: string; source?: string };
    const address = body.address?.trim();
    const chain = body.chain?.trim().toLowerCase();
    if (!address || !chain) return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });

    let source = body.source ?? null;
    if (!source) {
      if (!EVM.has(chain)) {
        return NextResponse.json({ address, chain, flagged: false, imminence: 'none', matches: [], note: 'Forecasting is EVM source-based for now.' });
      }
      source = await fetchVerifiedSource(address, chain);
      if (!source) {
        return NextResponse.json({ address, chain, flagged: false, imminence: 'none', matches: [], note: 'No verified source available to forecast against.' });
      }
    }

    await seedBaseline(); // ensure there's something to match
    const sigs = await getSignatures();
    const result = forecast(source, sigs);
    return NextResponse.json({ address, chain, signaturesChecked: sigs.length, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'forecast failed' }, { status: 500 });
  }
}
