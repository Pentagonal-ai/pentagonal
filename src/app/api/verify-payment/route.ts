/**
 * Pentagonal — EVM Payment Verification
 * Verifies on-chain ERC20/native token transfers and credits the user.
 * 
 * SECURITY: userId comes from session, credits derived from packId server-side.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog, type Address, type Chain } from 'viem';
import { mainnet, polygon, bsc, arbitrum, base, optimism, avalanche } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, ERC20_TRANSFER_ABI, CHAIN_IDS, PACKS, type PaymentToken } from '@/lib/payments';
import { verifyPaymentAmount } from '@/lib/price-oracle';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

// ─── Supabase admin client (bypasses RLS) ───
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Chain lookup ───
const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  polygon,
  bsc,
  arbitrum,
  base,
  optimism,
  avalanche,
};

// ─── Derive credit type from packId ───
function getCreditTypeFromPack(packId: string): string {
  if (packId.includes('create')) return 'creation';
  if (packId.includes('audit')) return 'audit';
  if (packId.includes('edit')) return 'edit';
  // For generic packs (pack_5, pack_10), default to creation
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
    const { txHash, chain, token, expectedUsd, packId } = body;

    if (!txHash || !chain || !token || !expectedUsd || !packId) {
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

    // ── Create viem client ──
    const viemChain = CHAINS[chain];
    if (!viemChain) {
      return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
    }

    const client = createPublicClient({
      chain: viemChain,
      transport: http(),
    });

    // ── Wait for receipt ──
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash as Address,
      confirmations: 2,
      timeout: 60_000,
    });

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction reverted' }, { status: 400 });
    }

    const treasury = (process.env.TREASURY_WALLET_ADDRESS || '').toLowerCase();
    if (!treasury) {
      return NextResponse.json({ error: 'Treasury address not configured' }, { status: 500 });
    }

    let amountRaw = '0';
    let amountUsd = 0;

    const isNativeToken = ['ETH', 'BNB'].includes(token);

    if (isNativeToken) {
      // ── Native token: check transaction value ──
      const tx = await client.getTransaction({ hash: txHash as Address });
      if (tx.to?.toLowerCase() !== treasury) {
        return NextResponse.json({ error: 'Transaction not sent to treasury' }, { status: 400 });
      }

      const decimals = TOKEN_DECIMALS[token] || 18;
      const received = Number(tx.value) / (10 ** decimals);
      amountRaw = tx.value.toString();

      const verification = await verifyPaymentAmount(received, token as PaymentToken, expectedUsd);
      if (!verification.valid) {
        return NextResponse.json({
          error: `Insufficient amount: received $${verification.receivedUsd.toFixed(2)}, expected $${verification.expectedUsd}`,
        }, { status: 400 });
      }
      amountUsd = verification.receivedUsd;
    } else {
      // ── ERC20: decode Transfer event logs ──
      const tokenAddress = TOKEN_ADDRESSES[chain]?.[token]?.toLowerCase();
      if (!tokenAddress) {
        return NextResponse.json({ error: `${token} not supported on ${chain}` }, { status: 400 });
      }

      let foundTransfer = false;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenAddress) continue;

        try {
          const decoded = decodeEventLog({
            abi: ERC20_TRANSFER_ABI,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === 'Transfer') {
            const args = decoded.args as { from: string; to: string; value: bigint };
            if (args.to.toLowerCase() === treasury) {
              const decimals = TOKEN_DECIMALS[token] || 6;
              const received = Number(args.value) / (10 ** decimals);
              amountRaw = args.value.toString();

              const verification = await verifyPaymentAmount(received, token as PaymentToken, expectedUsd);
              if (!verification.valid) {
                return NextResponse.json({
                  error: `Insufficient amount: received $${verification.receivedUsd.toFixed(2)}, expected $${verification.expectedUsd}`,
                }, { status: 400 });
              }
              amountUsd = verification.receivedUsd;
              foundTransfer = true;
              break;
            }
          }
        } catch {
          // Not a Transfer event, skip
        }
      }

      if (!foundTransfer) {
        return NextResponse.json({ error: 'No valid transfer to treasury found in transaction' }, { status: 400 });
      }
    }

    // ── Record payment ──
    const { error: paymentErr } = await supabase.from('payment_history').insert({
      user_id: userId,
      tx_hash: txHash,
      chain,
      token,
      amount_raw: amountRaw,
      amount_usd: amountUsd,
      credits_type: creditsType,
      credits_amount: creditsAmount,
      pack_id: packId,
    });

    if (paymentErr) {
      console.error('[verify-payment] Insert error:', paymentErr);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    // ── Upsert credits ──
    const { error: creditErr } = await supabase.rpc('increment_credits', {
      p_user_id: userId,
      p_credit_type: creditsType,
      p_amount: creditsAmount,
    });

    // Fallback: if RPC doesn't exist, do manual upsert
    if (creditErr) {
      console.warn('[verify-payment] RPC fallback, using upsert:', creditErr.message);
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
    }

    return NextResponse.json({ success: true, creditsAdded: creditsAmount });
  } catch (err) {
    console.error('[verify-payment] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
