// Pentagonal Sentinel — adaptive signatures API (Chunk 5)
// GET  -> list signatures (auto-seeds the baseline if empty). Public read.
// POST -> learn from findings, or re-seed (service-role bearer guarded).

import { NextRequest, NextResponse } from 'next/server';
import { getSignatures, seedBaseline, recordSignatures } from '@/lib/sentinel/signatures';

export async function GET() {
  await seedBaseline(); // idempotent
  const signatures = await getSignatures();
  return NextResponse.json({ count: signatures.length, signatures });
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      seed?: boolean;
      source?: string;
      findings?: { title?: string; severity?: string; description?: string }[];
    };
    let added = 0;
    if (body.seed) added += await seedBaseline();
    if (body.findings?.length) added += await recordSignatures(body.findings, body.source ?? 'audit');
    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
