// Pentagonal Sentinel — wallet approval guard endpoint (Chunk 6)
// POST { address, chain } -> the wallet's risky token approvals.

import { NextRequest, NextResponse } from 'next/server';
import { scanApprovals } from '@/lib/sentinel/approvals';

const EVM = new Set(['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { address?: string; chain?: string };
    const address = body.address?.trim();
    const chain = body.chain?.trim().toLowerCase();
    if (!address || !chain) return NextResponse.json({ error: 'address and chain are required' }, { status: 400 });
    if (!EVM.has(chain)) {
      return NextResponse.json({ wallet: address, chain, supported: false, totalApprovals: 0, risky: [], note: 'Approval guard is EVM-only for now.' });
    }
    const scan = await scanApprovals(address, chain);
    return NextResponse.json(scan);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'wallet scan failed' }, { status: 500 });
  }
}
