/**
 * Pentagonal — Solana Payment Verification
 * Verifies SOL/SPL token transfers on Solana and credits the user.
 * 
 * SECURITY: userId comes from session, credits derived from packId server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, PACKS, type PaymentToken } from '@/lib/payments';
import { verifyPaymentAmount } from '@/lib/price-oracle';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

// ─── Supabase admin client ───
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Solana connection ───
function getConnection() {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || clusterApiUrl('mainnet-beta');
  return new Connection(rpc, 'confirmed');
}

// ─── Derive credit type from packId ───
function getCreditTypeFromPack(packId: string): string {
  if (packId.includes('create')) return 'creation';
  if (packId.includes('audit')) return 'audit';
  if (packId.includes('edit')) return 'edit';
  return 'creation';
}

export async function POST(request: NextRequest) {
  // ── Auth gate — get userId from session, NOT from body ──
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.id;

  // ── Rate limit ──
  const limited = checkRateLimit(userId, 'utility');
  if (limited) return limited;

  try {
    const body = await request.json();
    const { txHash, token, expectedUsd, packId } = body;

    if (!txHash || !token || !expectedUsd || !packId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Derive credits from server-side pack definition ──
    const pack = PACKS[packId];
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 });
    }
    const creditsType = getCreditTypeFromPack(packId);
    const creditsAmount = pack.credits;

    // ── Verify expectedUsd matches pack price ──
    if (Math.abs(expectedUsd - pack.price) > 0.01) {
      return NextResponse.json({ error: 'Price mismatch' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // ── Check for duplicate tx ──
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('tx_hash', txHash)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
    }

    const connection = getConnection();
    const treasury = process.env.TREASURY_SOLANA_ADDRESS;
    if (!treasury) {
      return NextResponse.json({ error: 'Solana treasury address not configured' }, { status: 500 });
    }

    // Wait for confirmation
    const confirmed = await connection.confirmTransaction(txHash, 'confirmed');
    if (confirmed.value.err) {
      return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
    }

    // Get parsed transaction
    const tx = await connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    let amountRaw = '0';
    let amountUsd = 0;

    if (token === 'SOL') {
      // ── Native SOL transfer ──
      const treasuryIndex = tx.transaction.message.accountKeys.findIndex(
        k => k.pubkey.toBase58() === treasury
      );

      if (treasuryIndex === -1) {
        return NextResponse.json({ error: 'Treasury not found in transaction accounts' }, { status: 400 });
      }

      const preBalance = tx.meta.preBalances[treasuryIndex];
      const postBalance = tx.meta.postBalances[treasuryIndex];
      const lamportsReceived = postBalance - preBalance;

      if (lamportsReceived <= 0) {
        return NextResponse.json({ error: 'No SOL received by treasury' }, { status: 400 });
      }

      const solReceived = lamportsReceived / 1e9;
      amountRaw = lamportsReceived.toString();

      const verification = await verifyPaymentAmount(solReceived, 'SOL', expectedUsd);
      if (!verification.valid) {
        return NextResponse.json({
          error: `Insufficient amount: received $${verification.receivedUsd.toFixed(2)}, expected $${expectedUsd}`,
        }, { status: 400 });
      }
      amountUsd = verification.receivedUsd;

    } else {
      // ── SPL token transfer (USDC/USDT) ──
      const expectedMint = TOKEN_ADDRESSES.solana[token];
      if (!expectedMint) {
        return NextResponse.json({ error: `Unsupported Solana token: ${token}` }, { status: 400 });
      }

      const postTokenBalances = tx.meta.postTokenBalances || [];
      const preTokenBalances = tx.meta.preTokenBalances || [];

      let received = 0;

      for (const post of postTokenBalances) {
        if (post.mint !== expectedMint) continue;
        if (post.owner !== treasury) continue;

        const pre = preTokenBalances.find(
          p => p.accountIndex === post.accountIndex && p.mint === expectedMint
        );

        const postAmount = Number(post.uiTokenAmount.uiAmount || 0);
        const preAmount = pre ? Number(pre.uiTokenAmount.uiAmount || 0) : 0;
        received = postAmount - preAmount;
        break;
      }

      if (received <= 0) {
        return NextResponse.json({ error: `No ${token} received by treasury` }, { status: 400 });
      }

      const decimals = TOKEN_DECIMALS[token] || 6;
      amountRaw = Math.round(received * (10 ** decimals)).toString();

      const verification = await verifyPaymentAmount(received, token as PaymentToken, expectedUsd);
      if (!verification.valid) {
        return NextResponse.json({
          error: `Insufficient amount: received $${verification.receivedUsd.toFixed(2)}, expected $${expectedUsd}`,
        }, { status: 400 });
      }
      amountUsd = verification.receivedUsd;
    }

    // ── Record payment ──
    const { error: paymentErr } = await supabase.from('payment_history').insert({
      user_id: userId,
      tx_hash: txHash,
      chain: 'solana',
      token,
      amount_raw: amountRaw,
      amount_usd: amountUsd,
      credits_type: creditsType,
      credits_amount: creditsAmount,
      pack_id: packId,
    });

    if (paymentErr) {
      console.error('[verify-payment/solana] Insert error:', paymentErr);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    // ── Upsert credits ──
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('remaining')
      .eq('user_id', userId)
      .eq('credit_type', creditsType)
      .single();

    if (existingCredits) {
      await supabase
        .from('credits')
        .update({ remaining: existingCredits.remaining + creditsAmount })
        .eq('user_id', userId)
        .eq('credit_type', creditsType);
    } else {
      await supabase
        .from('credits')
        .insert({ user_id: userId, credit_type: creditsType, remaining: creditsAmount });
    }

    return NextResponse.json({ success: true, creditsAdded: creditsAmount });
  } catch (err) {
    console.error('[verify-payment/solana] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
