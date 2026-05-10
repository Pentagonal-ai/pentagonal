// ─── Four.meme on-chain verifier ─────────────────────────
// Uses TokenManagerHelper3 (BSC) to confirm a token belongs to
// Four.meme and read its bonding-curve state in a single eth_call.
//
// Helper3 returns version > 0 for any V1 or V2 Four.meme token,
// and zero-bytes for everything else. Free, server-side, no API
// key required; works against any public BSC RPC.

const HELPER3_ADDRESS = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';
const TOKEN_MANAGER_V2 = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
// 4-byte selector for getTokenInfo(address)
const SELECTOR_GET_TOKEN_INFO = '0x1f69565f';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const DEFAULT_RPC = 'https://bsc-dataseed.binance.org';

export type FourMemeTokenInfo = {
  version: number;          // 1 (V1) or 2 (V2)
  tokenManager: string;     // V1 or V2 manager address
  quote: string | null;     // quote asset address; null if zero
  lastPrice: bigint;        // raw price in wei units of quote asset
  tradingFeeRate: number;   // fraction (e.g. 0.01 == 1%)
  minTradingFee: bigint;    // raw wei
  launchTime: number;       // UNIX seconds
  offers: bigint;           // tokens sold so far
  maxOffers: bigint;        // total tokens to sell on the curve
  funds: bigint;            // BNB raised so far (wei)
  maxFunds: bigint;         // BNB target (wei) — graduation threshold
  liquidityAdded: boolean;  // graduated to PancakeSwap
};

function pad32(hex: string): string {
  return hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

function decodeUint256(hex: string, offset: number): bigint {
  return BigInt('0x' + hex.slice(offset, offset + 64));
}

function decodeAddress(hex: string, offset: number): string {
  return '0x' + hex.slice(offset + 24, offset + 64);
}

function decodeBool(hex: string, offset: number): boolean {
  return hex.slice(offset, offset + 64) !== '0'.repeat(64);
}

/**
 * Calls Helper3.getTokenInfo(token) via raw JSON-RPC.
 * Returns parsed token info if the address is a Four.meme token,
 * or null otherwise (Helper3 returns all-zero bytes for non-Four.meme).
 */
export async function getFourMemeTokenInfo(
  token: string,
  rpcUrl: string = DEFAULT_RPC,
): Promise<FourMemeTokenInfo | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) return null;

  const calldata = SELECTOR_GET_TOKEN_INFO + pad32(token);

  let raw: string | null = null;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: HELPER3_ADDRESS, data: calldata }, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result && typeof data.result === 'string') raw = data.result;
  } catch {
    return null;
  }

  if (!raw) return null;
  const hex = raw.replace(/^0x/, '');
  // Expect 12 fields × 32 bytes = 768 hex chars
  if (hex.length < 768) return null;

  const version = Number(decodeUint256(hex, 0));
  if (version === 0) return null; // not a Four.meme token

  return {
    version,
    tokenManager: decodeAddress(hex, 64),
    quote: (() => { const q = decodeAddress(hex, 128); return q === ZERO_ADDR ? null : q; })(),
    lastPrice: decodeUint256(hex, 192),
    tradingFeeRate: Number(decodeUint256(hex, 256)) / 10000,
    minTradingFee: decodeUint256(hex, 320),
    launchTime: Number(decodeUint256(hex, 384)),
    offers: decodeUint256(hex, 448),
    maxOffers: decodeUint256(hex, 512),
    funds: decodeUint256(hex, 576),
    maxFunds: decodeUint256(hex, 640),
    liquidityAdded: decodeBool(hex, 704),
  };
}

/**
 * Compute progress through the bonding curve as a fraction 0–1.
 * Prefers offers/maxOffers (token-units sold) over funds/maxFunds
 * because some templates bound on offers first.
 */
export function bondingCurveProgress(info: FourMemeTokenInfo): number {
  const ZERO = BigInt(0);
  const SCALE = BigInt(10000);
  if (info.liquidityAdded) return 1;
  if (info.maxOffers > ZERO) {
    return Number((info.offers * SCALE) / info.maxOffers) / 10000;
  }
  if (info.maxFunds > ZERO) {
    return Number((info.funds * SCALE) / info.maxFunds) / 10000;
  }
  return 0;
}

/** Manager address constants exposed for matching. */
export const FOUR_MEME = {
  helper3: HELPER3_ADDRESS,
  tokenManagerV2: TOKEN_MANAGER_V2,
};
