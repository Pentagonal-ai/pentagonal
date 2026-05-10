// ─── Flap (flap.sh) on-chain verifier ────────────────────
// Uses the Flap Portal (BSC) to confirm a token belongs to
// Flap and read its bonding-curve state in a single eth_call.
//
// Portal.getTokenV8Safe(address) returns the full token state.
// status === 0 (Invalid) means the address is not a Flap token.
// Otherwise we have version, price, tax rates, pool, and a
// normalised progress fraction (0 to 1e18 = 100%).
//
// Source: github.com/flap-sh/FlapVaultExample (test/FlapBSCFixture.sol)
// Vanity suffix used by Flap: 7777.

const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
// 4-byte selector for getTokenV8Safe(address)
const SELECTOR_GET_TOKEN_V8_SAFE = '0x62fafcca';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const DEFAULT_RPC = 'https://bsc-dataseed.binance.org';
const ONE_E18 = BigInt('1000000000000000000');
const SCALE = BigInt(10000);

// TokenStatus enum (matches IPortal.sol):
// 0=Invalid, 1=Tradable, 2=InDuel(obsolete), 3=Killed(obsolete),
// 4=DEX (graduated to PancakeSwap), 5=Staged
export type FlapTokenStatus = 'Invalid' | 'Tradable' | 'InDuel' | 'Killed' | 'DEX' | 'Staged' | 'Unknown';

export type FlapTokenInfo = {
  status: number;             // raw uint8
  statusName: FlapTokenStatus;
  reserve: bigint;            // quote-token reserve in bonding curve
  circulatingSupply: bigint;
  price: bigint;              // 18-decimal price
  tokenVersion: number;       // see TokenVersion enum (6 = FlapTaxTokenV3)
  buyTaxRate: number;         // basis points (300 = 3%)
  sellTaxRate: number;        // basis points
  pool: string | null;        // DEX pool address; null if still on bonding curve
  progress: bigint;           // 0 to 1e18 (1e18 = 100%)
  liquidityAdded: boolean;    // pool != 0 OR status === DEX
};

function pad32(hex: string): string {
  return hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
}

function decodeUint256(hex: string, offset: number): bigint {
  return BigInt('0x' + hex.slice(offset, offset + 64));
}

function decodeUint8(hex: string, offset: number): number {
  return Number(decodeUint256(hex, offset));
}

function decodeAddress(hex: string, offset: number): string {
  return '0x' + hex.slice(offset + 24, offset + 64);
}

function statusName(s: number): FlapTokenStatus {
  switch (s) {
    case 0: return 'Invalid';
    case 1: return 'Tradable';
    case 2: return 'InDuel';
    case 3: return 'Killed';
    case 4: return 'DEX';
    case 5: return 'Staged';
    default: return 'Unknown';
  }
}

/**
 * Calls Portal.getTokenV8Safe(token) via raw JSON-RPC.
 * Returns parsed token state if the address is a Flap token,
 * or null otherwise (status === 0 = Invalid).
 */
export async function getFlapTokenInfo(
  token: string,
  rpcUrl: string = DEFAULT_RPC,
): Promise<FlapTokenInfo | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) return null;

  const calldata = SELECTOR_GET_TOKEN_V8_SAFE + pad32(token);

  let raw: string | null = null;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: PORTAL_ADDRESS, data: calldata }, 'latest'],
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
  // 18 fields × 32 bytes = 1152 hex chars; some calls may include trailing
  // dynamic data, so accept any length ≥ 1152.
  if (hex.length < 1152) return null;

  const status = decodeUint8(hex, 0);
  if (status === 0) return null; // Invalid → not a Flap token

  const pool = decodeAddress(hex, 14 * 64);
  const liquidityAdded = pool !== ZERO_ADDR || status === 4;

  return {
    status,
    statusName: statusName(status),
    reserve: decodeUint256(hex, 1 * 64),
    circulatingSupply: decodeUint256(hex, 2 * 64),
    price: decodeUint256(hex, 3 * 64),
    tokenVersion: decodeUint8(hex, 4 * 64),
    buyTaxRate: Number(decodeUint256(hex, 12 * 64)),
    sellTaxRate: Number(decodeUint256(hex, 13 * 64)),
    pool: pool === ZERO_ADDR ? null : pool,
    progress: decodeUint256(hex, 15 * 64),
    liquidityAdded,
  };
}

/** Bonding curve progress as a 0–1 fraction. */
export function flapBondingCurveProgress(info: FlapTokenInfo): number {
  if (info.liquidityAdded) return 1;
  if (info.progress === BigInt(0)) return 0;
  // Cap at 1 — should never exceed but defensive
  const scaled = (info.progress * SCALE) / ONE_E18;
  const v = Number(scaled) / 10000;
  return Math.min(1, v);
}

// Display values derived from FlapTokenInfo. Numbers are JS Number
// (not bigint) for direct rendering; lossy but acceptable for memecoin
// market caps. Pass `bnbUsd` to populate USD fields.
export type FlapDisplayStats = {
  priceBnb: number;        // BNB per token
  priceUsd: number | null; // USD per token (null if no bnbUsd)
  marketCapBnb: number;
  marketCapUsd: number | null;
  liquidityBnb: number;    // reserve held by curve, in BNB
  liquidityUsd: number | null;
  buyTaxPct: number;       // 0–100
  sellTaxPct: number;      // 0–100
  circulatingSupply: number;
};

function bigToNumber(value: bigint, decimals: number): number {
  // Avoid precision loss on the way down by dividing two BigInts first
  const denom = BigInt(10) ** BigInt(decimals);
  const whole = Number(value / denom);
  const frac = Number(value % denom) / Number(denom);
  return whole + frac;
}

export function flapDisplayStats(info: FlapTokenInfo, bnbUsd: number | null = null): FlapDisplayStats {
  const priceBnb = bigToNumber(info.price, 18);
  // priceBnb * supply gives market cap in BNB.
  // info.circulatingSupply is in token wei (18 decimals); divide once more.
  const supply = bigToNumber(info.circulatingSupply, 18);
  const marketCapBnb = priceBnb * supply;
  const liquidityBnb = bigToNumber(info.reserve, 18);

  return {
    priceBnb,
    priceUsd: bnbUsd != null ? priceBnb * bnbUsd : null,
    marketCapBnb,
    marketCapUsd: bnbUsd != null ? marketCapBnb * bnbUsd : null,
    liquidityBnb,
    liquidityUsd: bnbUsd != null ? liquidityBnb * bnbUsd : null,
    buyTaxPct: info.buyTaxRate / 100,
    sellTaxPct: info.sellTaxRate / 100,
    circulatingSupply: supply,
  };
}

export const FLAP = {
  portal: PORTAL_ADDRESS,
};
