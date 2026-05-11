import 'server-only';

// ─── BNB → USD price ─────────────────────────────────────
// In-memory cached fetch via DexScreener WBNB/USDT pair on BSC.
// 60-second TTL. Returns null on failure so callers can fall back
// to BNB-denominated display.

const WBNB_BSC = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const TTL_MS = 60_000;

let cached: { price: number; expires: number } | null = null;

export async function getBnbUsd(): Promise<number | null> {
  if (cached && Date.now() < cached.expires) return cached.price;

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WBNB_BSC}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return cached?.price ?? null;
    const data = await res.json();
    const pairs = (data?.pairs as Array<{ chainId?: string; priceUsd?: string; liquidity?: { usd?: number } }>) || [];
    const bsc = pairs
      .filter(p => p.chainId === 'bsc' && p.priceUsd)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const top = bsc[0];
    if (!top?.priceUsd) return cached?.price ?? null;
    const price = Number(top.priceUsd);
    if (!isFinite(price) || price <= 0) return cached?.price ?? null;

    cached = { price, expires: Date.now() + TTL_MS };
    return price;
  } catch {
    return cached?.price ?? null;
  }
}
