/**
 * Pentagonal — Price Quote API
 * Returns live token price and conversion amount for the PaymentModal.
 */
import { NextRequest, NextResponse } from 'next/server';
import { convertUsdToToken } from '@/lib/price-oracle';
import type { PaymentToken } from '@/lib/payments';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token') as PaymentToken;
  const usd = Number(searchParams.get('usd'));

  if (!token || !usd || isNaN(usd)) {
    return NextResponse.json({ error: 'Missing token or usd param' }, { status: 400 });
  }

  try {
    const result = await convertUsdToToken(usd, token);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Price fetch failed' },
      { status: 500 }
    );
  }
}
