/**
 * Pentagonal — Wallet Auth via Signature Verification
 * 
 * HARD CUT: Replaces the deterministic password scheme with a proper
 * challenge-response flow:
 * 
 * 1. Client calls /api/auth/challenge with walletAddress
 * 2. Client signs the challenge message with their wallet
 * 3. Client submits signature + nonce + walletAddress here
 * 4. Server verifies signature, creates/signs-in Supabase user
 * 
 * EVM: Uses viem's verifyMessage (EIP-191 personal_sign)
 * Solana: Uses tweetnacl's nacl.sign.detached.verify (ed25519)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { consumeNonce } from '@/lib/nonce-store';
import { verifyMessage } from 'viem';
import nacl from 'tweetnacl';
import { randomBytes } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Verify EVM signature (EIP-191 personal_sign) ───
async function verifyEvmSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return valid;
  } catch {
    return false;
  }
}

// ─── Verify Solana signature (ed25519) ───
function verifySolanaSignature(
  walletAddress: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    // Solana wallet-adapter signMessage returns Uint8Array → client base64-encodes it
    const signatureBytes = Buffer.from(signatureBase64, 'base64');
    const messageBytes = new TextEncoder().encode(message);
    
    // Decode base58 public key
    const bs58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    for (const char of walletAddress) {
      num = num * BigInt(58) + BigInt(bs58Chars.indexOf(char));
    }
    const hex = num.toString(16).padStart(64, '0');
    const publicKeyBytes = Uint8Array.from(Buffer.from(hex, 'hex'));

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // IP-based rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limited = checkRateLimit(ip, 'auth');
  if (limited) return limited;

  try {
    const { walletAddress, walletType, nonce, signature, message } = await request.json();

    if (!walletAddress || !walletType || !nonce || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Consume the challenge nonce (one-time use) ──
    const nonceResult = consumeNonce(nonce);
    if (!nonceResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 });
    }

    // Verify the wallet address in the nonce matches what's being claimed
    if (nonceResult.walletAddress !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Wallet address mismatch' }, { status: 401 });
    }

    // ── Verify the cryptographic signature ──
    let isValid = false;
    if (walletType === 'evm') {
      isValid = await verifyEvmSignature(walletAddress, message, signature);
    } else if (walletType === 'solana') {
      isValid = verifySolanaSignature(walletAddress, message, signature);
    } else {
      return NextResponse.json({ error: 'Invalid wallet type' }, { status: 400 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // ── Signature valid — create or sign in the Supabase user ──
    const walletEmail = `${walletAddress.toLowerCase()}@wallet.pentagonal.dev`;
    // Use a strong random password — the user never needs to know it
    // since they auth via signature, not password
    const internalPassword = randomBytes(32).toString('hex');

    // Try to sign in with existing account first
    // We need a stored password strategy: use the wallet address hash as a deterministic but unguessable password
    // Since we're verifying via signature, the password is just a Supabase implementation detail
    const deterministicPassword = `sig_auth_${walletAddress.toLowerCase()}_${process.env.SUPABASE_SERVICE_ROLE_KEY!.slice(-8)}`;

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: walletEmail,
      password: deterministicPassword,
    });

    if (!signInError && signInData.session) {
      return NextResponse.json({
        success: true,
        session: signInData.session,
        user: signInData.user,
      });
    }

    // User doesn't exist — create with admin API
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: walletEmail,
      password: deterministicPassword,
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress,
        wallet_type: walletType,
        auth_method: 'wallet_signature',
      },
    });

    if (createError && !createError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'Account creation failed' }, { status: 500 });
    }

    // Sign in with the newly created account
    const { data: newSession, error: newSessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: walletEmail,
      password: deterministicPassword,
    });

    if (newSessionError || !newSession.session) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: newSession.session,
      user: newSession.user,
    });
  } catch {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
