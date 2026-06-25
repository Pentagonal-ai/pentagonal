// Pentagonal Sentinel — Quantum exposure scan (Chunk 2)
// POST { address, chain } -> crypto-agility findings (EVM source analysis).

import { NextRequest, NextResponse } from 'next/server';
import { analyzeQuantumExposure, fetchVerifiedSource } from '@/lib/quantum/scan';

const EVM = new Set(['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { address?: string; chain?: string; source?: string };
    const address = body.address?.trim();
    const chain = body.chain?.trim().toLowerCase();

    if (!address || !chain) {
      return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    }

    // Allow passing source directly (e.g. from an audit run); otherwise fetch verified source.
    let source = body.source ?? null;
    if (!source) {
      if (!EVM.has(chain)) {
        return NextResponse.json({
          address, chain, exposed: false, severity: 'none', primitives: [], findings: [],
          note: 'Source-based quantum analysis is EVM-only for now (no verified-source fetch for this chain).',
        });
      }
      source = await fetchVerifiedSource(address, chain);
      if (!source) {
        return NextResponse.json({
          address, chain, exposed: false, severity: 'none', primitives: [], findings: [],
          note: 'No verified source available for this contract — cannot analyze cryptographic primitives.',
        });
      }
    }

    const result = analyzeQuantumExposure(source);
    return NextResponse.json({ address, chain, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'quantum scan failed' },
      { status: 500 },
    );
  }
}
