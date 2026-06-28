import { NextRequest, NextResponse } from 'next/server';
import { checkTokenHolder } from '@/lib/token-gate';

// Public, read-only: does this wallet hold >= 0.25% of the gating token?
// Used by the home-page callout to personalize ("you qualify") when a wallet
// is connected. No auth — it only reads an on-chain balance.

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ isHolder: false });
  }
  const h = await checkTokenHolder(address);
  return NextResponse.json({ isHolder: h.eligible });
}
