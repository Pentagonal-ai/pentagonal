import { NextResponse } from 'next/server';

// Live stats for the PENT gating token (ERC-20 on Ethereum), via DexScreener.
// Cached 60s at the route + upstream-fetch level so the home-page badge is fast
// and we don't hammer DexScreener regardless of traffic.

const TOKEN = '0x92B89BD08D7625407de0F9E746c6546d3b52d64f';

// Dynamic (not prerendered at build) so the build never depends on DexScreener
// being reachable; the upstream fetch below is still cached 60s.
export const dynamic = 'force-dynamic';

interface DexPair {
  chainId?: string;
  baseToken?: { symbol?: string; name?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  url?: string;
  pairAddress?: string;
}

export async function GET() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ error: 'unavailable' }, { status: 502 });

    const data = (await res.json()) as { pairs?: DexPair[] };
    const pairs = (data.pairs || []).filter((p) => p.chainId === 'ethereum');
    if (!pairs.length) return NextResponse.json({ error: 'no_pairs' }, { status: 404 });

    const p = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return NextResponse.json({
      symbol: p.baseToken?.symbol || 'PENT',
      name: p.baseToken?.name || 'Pentagonal',
      priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      change24h: p.priceChange?.h24 ?? null,
      marketCap: p.marketCap || p.fdv || null,
      liquidity: p.liquidity?.usd || null,
      volume24h: p.volume?.h24 || null,
      url: p.url || `https://dexscreener.com/ethereum/${TOKEN}`,
    });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
