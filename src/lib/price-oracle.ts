/**
 * Pentagonal — Price Oracle
 * Fetches live crypto prices from CoinGecko with in-memory caching.
 * Stablecoins (USDC/USDT) are hardcoded 1:1 — no API call needed.
 */

import { STABLECOINS, type PaymentToken } from './payments';

// ─── Cache ───
interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
let priceCache: PriceCache | null = null;

// CoinGecko ID mapping
const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
};

/**
 * Get current USD price for a native token.
 * Stablecoins return 1.0 immediately (no API call).
 */
export async function getTokenPriceUsd(token: PaymentToken): Promise<number> {
  if (STABLECOINS.includes(token)) return 1.0;

  const geckoId = COINGECKO_IDS[token];
  if (!geckoId) throw new Error(`No CoinGecko ID for ${token}`);

  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
    const cached = priceCache.prices[geckoId];
    if (cached) return cached;
  }

  // Fetch fresh prices for all native tokens at once
  const ids = Object.values(COINGECKO_IDS).join(',');
  const apiKey = process.env.COINGECKO_API_KEY;

  const url = apiKey
    ? `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&x_cg_demo_key=${apiKey}`
    : `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // If we have stale cache, use it rather than failing
      if (priceCache) {
        const stale = priceCache.prices[geckoId];
        if (stale) {
          console.warn(`[price-oracle] CoinGecko returned ${res.status}, using stale cache`);
          return stale;
        }
      }
      throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const data = await res.json();
    const prices: Record<string, number> = {};

    for (const [id, val] of Object.entries(data)) {
      prices[id] = (val as { usd: number }).usd;
    }

    priceCache = { prices, timestamp: Date.now() };

    const price = prices[geckoId];
    if (!price) throw new Error(`No price data for ${token}`);
    return price;
  } catch (err) {
    // Stale cache fallback
    if (priceCache) {
      const stale = priceCache.prices[geckoId];
      if (stale) {
        console.warn(`[price-oracle] Fetch failed, using stale cache for ${token}:`, err);
        return stale;
      }
    }
    throw err;
  }
}

/**
 * Convert a USD amount to a native token amount.
 * Adds a configurable slippage buffer (default 2%) to account for
 * price movement between quote and confirmation.
 */
export async function convertUsdToToken(
  usdAmount: number,
  token: PaymentToken,
  slippagePercent: number = 2
): Promise<{ tokenAmount: number; priceUsd: number; withSlippage: number }> {
  const priceUsd = await getTokenPriceUsd(token);

  if (STABLECOINS.includes(token)) {
    // Stablecoins: 1:1, no slippage
    return { tokenAmount: usdAmount, priceUsd: 1.0, withSlippage: usdAmount };
  }

  const baseAmount = usdAmount / priceUsd;
  const withSlippage = baseAmount * (1 + slippagePercent / 100);

  return {
    tokenAmount: baseAmount,
    priceUsd,
    withSlippage, // User pays this amount (slightly more to cover movement)
  };
}

/**
 * Check if a received token amount meets the minimum required USD value.
 * Used server-side during payment verification.
 */
export async function verifyPaymentAmount(
  receivedAmount: number,
  token: PaymentToken,
  expectedUsd: number,
  tolerancePercent: number = 3 // allow 3% underside tolerance
): Promise<{ valid: boolean; receivedUsd: number; expectedUsd: number }> {
  const priceUsd = await getTokenPriceUsd(token);
  const receivedUsd = STABLECOINS.includes(token)
    ? receivedAmount
    : receivedAmount * priceUsd;

  const minRequired = expectedUsd * (1 - tolerancePercent / 100);

  return {
    valid: receivedUsd >= minRequired,
    receivedUsd,
    expectedUsd,
  };
}
