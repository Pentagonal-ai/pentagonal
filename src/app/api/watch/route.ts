// Pentagonal Sentinel — watched contracts (Chunk 4)
// GET    -> the user's watched contracts (RLS owner-only)
// POST   -> start watching { address, chain, label? }
// DELETE -> stop watching ?id=<uuid>

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SUPPORTED = new Set([
  'ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'solana',
]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('watched_contracts')
    .select('id, address, chain, label, status, last_score, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watched: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  let body: { address?: string; chain?: string; label?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
  const address = body.address?.trim();
  const chain = body.chain?.trim().toLowerCase();
  if (!address || !chain) return NextResponse.json({ error: 'address and chain required' }, { status: 400 });
  if (!SUPPORTED.has(chain)) return NextResponse.json({ error: `unsupported chain: ${chain}` }, { status: 400 });

  const { data, error } = await supabase
    .from('watched_contracts')
    .upsert(
      { user_id: user.id, address: chain === 'solana' ? address : address.toLowerCase(), chain, label: body.label ?? null, status: 'active' },
      { onConflict: 'user_id,address,chain' },
    )
    .select('id, address, chain, label, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watched: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('watched_contracts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
