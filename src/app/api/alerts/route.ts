// Pentagonal Sentinel — alerts API (Chunk 3)
// GET  -> the signed-in user's alert feed (RLS owner-only).
// POST -> enqueue an alert (internal: requires the service-role key as bearer).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAlert, type AlertInput } from '@/lib/alerts/create';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('alerts')
    .select('id, type, severity, address, chain, payload, created_at, delivered')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  // Internal endpoint: only callers holding the service-role key may enqueue alerts.
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as AlertInput;
    if (!body?.type) return NextResponse.json({ error: 'type is required' }, { status: 400 });
    const id = await createAlert(body);
    if (!id) return NextResponse.json({ error: 'failed to create alert' }, { status: 500 });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
