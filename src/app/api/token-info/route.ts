import { NextRequest, NextResponse } from 'next/server';

// DexScreener chain slug mapping
const DEXSCREENER_CHAINS: Record<string, string> = {
  ethereum: 'ethereum',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  base: 'base',
  optimism: 'optimism',
  bsc: 'bsc',
  avalanche: 'avalanche',
  solana: 'solana',
};

export async function POST(req: NextRequest) {
  try {
    const { address, chainId } = await req.json();

    if (!address || !chainId) {
      return NextResponse.json({ error: 'Address and chainId required' }, { status: 400 });
    }

    const dexChain = DEXSCREENER_CHAINS[chainId];
    if (!dexChain) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }

    // DexScreener free API — no key needed
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'DexScreener unavailable' }, { status: 502 });
    }

    const data = await res.json();
    const pairs = data.pairs || [];

    // Filter to the correct chain and find the highest-liquidity pair
    const chainPairs = pairs.filter((p: { chainId: string }) => p.chainId === dexChain);
    const bestPair = chainPairs.sort((a: { liquidity?: { usd: number } }, b: { liquidity?: { usd: number } }) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];

    if (!bestPair) {
      // Not a tradeable token — might be a utility contract (WETH, etc.)
      return NextResponse.json({
        found: false,
        message: 'No trading pairs found. This may be a utility or infrastructure contract.',
      });
    }

    // Aggregate stats across all pairs on this chain
    const totalVolume24h = chainPairs.reduce((s: number, p: { volume?: { h24: number } }) => s + (p.volume?.h24 || 0), 0);
    const totalTxns24h = chainPairs.reduce((s: number, p: { txns?: { h24: { buys: number; sells: number } } }) =>
      s + (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0), 0);

    return NextResponse.json({
      found: true,
      name: bestPair.baseToken?.name || 'Unknown',
      symbol: bestPair.baseToken?.symbol || '???',
      address: bestPair.baseToken?.address || address,
      priceUsd: bestPair.priceUsd || null,
      priceChange24h: bestPair.priceChange?.h24 || null,
      volume24h: totalVolume24h,
      txns24h: totalTxns24h,
      buys24h: chainPairs.reduce((s: number, p: { txns?: { h24: { buys: number } } }) => s + (p.txns?.h24?.buys || 0), 0),
      sells24h: chainPairs.reduce((s: number, p: { txns?: { h24: { sells: number } } }) => s + (p.txns?.h24?.sells || 0), 0),
      liquidity: bestPair.liquidity?.usd || null,
      marketCap: bestPair.marketCap || bestPair.fdv || null,
      pairCount: chainPairs.length,
      dexName: bestPair.dexId || 'Unknown DEX',
      imageUrl: bestPair.info?.imageUrl || null,
      url: bestPair.url || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch token info';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
