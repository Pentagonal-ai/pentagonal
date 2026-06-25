// Pentagonal Sentinel — security intel (Chunk 1)
// Reuses the proven GoPlus (EVM) + RugCheck (Solana) sources, returning STRUCTURED
// signals for the Pentagon Score. Self-contained (does not import fetch-contract).

export type SecurityIntel = {
  address: string;
  chain: string;
  source: 'goplus' | 'rugcheck' | 'none';
  // Normalized signals; `undefined` means unknown / unavailable for this chain/source.
  isHoneypot?: boolean;
  cannotSell?: boolean;
  isMintable?: boolean;
  ownerCanModify?: boolean; // hidden owner / take-back / pausable / selfdestruct / balance-change
  isProxy?: boolean;
  ownerRenounced?: boolean;
  buyTaxPct?: number; // 0..100
  sellTaxPct?: number; // 0..100
  lpLockedPct?: number; // 0..100
  holderCount?: number;
  top10Pct?: number; // 0..100 — share held by top 10 holders
  rugScore?: number; // RugCheck score_normalised (higher = riskier)
  rugged?: boolean;
  mintAuthorityActive?: boolean; // Solana
  freezeAuthorityActive?: boolean; // Solana
};

const GOPLUS_CHAINS: Record<string, number> = {
  ethereum: 1, polygon: 137, arbitrum: 42161, base: 8453,
  optimism: 10, bsc: 56, avalanche: 43114,
};

const ZERO_OWNERS = new Set([
  '',
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]);

const bool = (v: unknown): boolean => v === '1' || v === 1 || v === true;
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

async function fetchJson<T>(url: string, ms = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

type GoPlusToken = Record<string, unknown>;
type RugReport = {
  score_normalised?: number;
  rugged?: boolean;
  totalHolders?: number;
  lpLockedPct?: number;
  markets?: { lp?: { lpLockedPct?: number } }[];
  topHolders?: { pct?: number }[];
  token?: { mintAuthority?: string | null; freezeAuthority?: string | null };
};

/** Fetch structured security signals for a token, source chosen by chain. */
export async function getSecurityIntel(address: string, chain: string): Promise<SecurityIntel> {
  const base = { address, chain };

  if (chain === 'solana') {
    const rc = await fetchJson<RugReport>(`https://api.rugcheck.xyz/v1/tokens/${address}/report`);
    if (!rc) return { ...base, source: 'none' };
    const top10 = (rc.topHolders ?? []).slice(0, 10).reduce((s, h) => s + (h.pct ?? 0), 0);
    const lpLocked = rc.markets?.[0]?.lp?.lpLockedPct ?? rc.lpLockedPct;
    return {
      ...base,
      source: 'rugcheck',
      rugScore: rc.score_normalised,
      rugged: rc.rugged,
      lpLockedPct: lpLocked,
      holderCount: rc.totalHolders,
      top10Pct: top10 || undefined,
      mintAuthorityActive: rc.token ? rc.token.mintAuthority != null : undefined,
      freezeAuthorityActive: rc.token ? rc.token.freezeAuthority != null : undefined,
    };
  }

  const chainId = GOPLUS_CHAINS[chain];
  if (!chainId) return { ...base, source: 'none' };

  const raw = await fetchJson<{ result?: Record<string, GoPlusToken> }>(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`,
  );
  const result = raw?.result ?? {};
  const key = Object.keys(result)[0];
  const gp = key ? result[key] : null;
  if (!gp) return { ...base, source: 'none' };

  const holders = (gp.holders as Array<{ percent?: string }>) ?? [];
  const top10 = holders.slice(0, 10).reduce((s, h) => s + parseFloat(h.percent ?? '0'), 0) * 100;
  const lpHolders = (gp.lp_holders as Array<{ percent?: string; is_locked?: number }>) ?? [];
  const lpLocked =
    lpHolders.reduce((s, h) => s + (bool(h.is_locked) ? parseFloat(h.percent ?? '0') : 0), 0) * 100;
  const ownerAddr = String(gp.owner_address ?? '').toLowerCase();
  const buyTax = num(gp.buy_tax);
  const sellTax = num(gp.sell_tax);

  return {
    ...base,
    source: 'goplus',
    isHoneypot: bool(gp.is_honeypot) || bool(gp.honeypot_with_same_creator),
    cannotSell: bool(gp.cannot_sell_all),
    isMintable: bool(gp.is_mintable),
    ownerCanModify:
      bool(gp.hidden_owner) || bool(gp.can_take_back_ownership) || bool(gp.transfer_pausable) ||
      bool(gp.selfdestruct) || bool(gp.owner_change_balance),
    isProxy: bool(gp.is_proxy),
    ownerRenounced: ZERO_OWNERS.has(ownerAddr),
    buyTaxPct: buyTax !== undefined ? buyTax * 100 : undefined,
    sellTaxPct: sellTax !== undefined ? sellTax * 100 : undefined,
    lpLockedPct: lpHolders.length ? lpLocked : undefined,
    holderCount: num(gp.holder_count),
    top10Pct: holders.length ? top10 : undefined,
  };
}
