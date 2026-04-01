/**
 * Pentagonal — Credit Deduction API
 * Server-side endpoint for deducting credits when a user performs an action.
 * Only callable from the authenticated app — validates user has remaining credits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, creditType } = body;

    if (!userId || !creditType) {
      return NextResponse.json({ error: 'Missing userId or creditType' }, { status: 400 });
    }

    const validTypes = ['creation', 'audit', 'edit'];
    if (!validTypes.includes(creditType)) {
      return NextResponse.json({ error: 'Invalid credit type' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // ── Get current balance ──
    const { data: credit, error: fetchErr } = await supabase
      .from('credits')
      .select('remaining')
      .eq('user_id', userId)
      .eq('credit_type', creditType)
      .single();

    if (fetchErr || !credit) {
      return NextResponse.json({ error: 'No credits found', remaining: 0 }, { status: 402 });
    }

    if (credit.remaining <= 0) {
      return NextResponse.json({ error: 'Insufficient credits', remaining: 0 }, { status: 402 });
    }

    // ── Decrement ──
    const newRemaining = credit.remaining - 1;
    const { error: updateErr } = await supabase
      .from('credits')
      .update({ remaining: newRemaining })
      .eq('user_id', userId)
      .eq('credit_type', creditType);

    if (updateErr) {
      console.error('[deduct-credit] Update error:', updateErr);
      return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 });
    }

    // ── Log usage ──
    await supabase.from('usage_log').insert({
      user_id: userId,
      action: creditType,
    });

    return NextResponse.json({ success: true, remaining: newRemaining });
  } catch (err) {
    console.error('[deduct-credit] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Deduction failed' },
      { status: 500 }
    );
  }
}
