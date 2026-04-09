/**
 * Pentagonal — API Keys CRUD
 * GET  /api/api-keys  → list user's keys (hashes hidden, only metadata)
 * POST /api/api-keys  → generate a new key (returns raw key ONCE)
 * DELETE /api/api-keys?id=<uuid>  → revoke a key
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'pent_';
const KEY_BYTES = 32; // 256 bits of entropy

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function sha256hex(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRawKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${PREFIX}${hex}`;
}

// ── GET — list keys for the authenticated user ─────────────────────────────
export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, created_at, last_used_at, revoked_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}

// ── POST — generate a new key ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let name = 'Default';
  try {
    const body = await req.json().catch(() => ({}));
    if (body.name && typeof body.name === 'string') {
      name = body.name.slice(0, 64).trim();
    }
  } catch { /* no body — use default name */ }

  // Check limit: max 5 active keys per user
  const supabase = getAdminClient();
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .is('revoked_at', null);

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Max 5 active API keys per account. Revoke one first.' },
      { status: 400 }
    );
  }

  const rawKey = generateRawKey();
  const hash = await sha256hex(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: auth.user.id,
      key_hash: hash,
      name,
    })
    .select('id, name, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  // Return the raw key ONCE — we never store it and can never recover it
  return NextResponse.json({
    id: data.id,
    name: data.name,
    created_at: data.created_at,
    key: rawKey, // ⚠ shown once only
  });
}

// ── DELETE — revoke a key by id ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id); // RLS double-check

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
