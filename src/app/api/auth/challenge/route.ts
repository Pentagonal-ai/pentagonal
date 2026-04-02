/**
 * Pentagonal — Auth Challenge API
 * Issues cryptographic challenges for wallet signature verification.
 * 
 * Flow: Client requests challenge → signs with wallet → submits to /api/auth/wallet
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { storeNonce } from '@/lib/nonce-store';

export async function POST(request: NextRequest) {
  // IP-based rate limit (pre-auth)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limited = checkRateLimit(ip, 'auth');
  if (limited) return limited;

  try {
    const { walletAddress } = await request.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const nonce = randomBytes(32).toString('hex');
    const message = `Sign this message to authenticate with Pentagonal.\n\nWallet: ${walletAddress.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    storeNonce(nonce, walletAddress);

    return NextResponse.json({ nonce, message });
  } catch {
    return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
  }
}
