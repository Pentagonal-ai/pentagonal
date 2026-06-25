// Pentagonal Sentinel — wallet approval guard (Chunk 6)
// Enumerates a wallet's ERC20 approvals via GoPlus and flags the risky ones
// (unlimited allowances, malicious/untrusted spenders).

const GOPLUS_CHAINS: Record<string, number> = {
  ethereum: 1, polygon: 137, arbitrum: 42161, base: 8453,
  optimism: 10, bsc: 56, avalanche: 43114,
};

export type ApprovalRisk = {
  token: string;
  tokenSymbol?: string;
  spender: string;
  spenderTag?: string;
  amount: string;
  flags: string[]; // 'unlimited' | 'malicious' | 'flagged' | 'unverified'
};

export type WalletScan = {
  wallet: string;
  chain: string;
  supported: boolean;
  totalApprovals: number;
  risky: ApprovalRisk[];
};

type AddrInfo = {
  is_contract?: number; tag?: string; trust_list?: number; doubt_list?: number;
  malicious_behavior?: unknown[];
};
type Approved = { approved_contract?: string; approved_amount?: string; address_info?: AddrInfo };
type TokenApproval = { token_address?: string; token_symbol?: string; approved_list?: Approved[] };

const isUnlimited = (amt?: string): boolean => {
  if (!amt) return false;
  if (/unlimited/i.test(amt)) return true;
  const n = Number(amt);
  return Number.isFinite(n) && n > 1e30;
};

export async function scanApprovals(wallet: string, chain: string): Promise<WalletScan> {
  const chainId = GOPLUS_CHAINS[chain];
  if (!chainId) return { wallet, chain, supported: false, totalApprovals: 0, risky: [] };

  let result: TokenApproval[] = [];
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(
      `https://api.gopluslabs.io/api/v2/token_approval_security/${chainId}?addresses=${wallet.toLowerCase()}`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    );
    clearTimeout(id);
    if (r.ok) {
      const d = (await r.json()) as { result?: TokenApproval[] };
      result = d?.result ?? [];
    }
  } catch { /* network/parse — return empty */ }

  let total = 0;
  const risky: ApprovalRisk[] = [];
  for (const t of result) {
    for (const a of t.approved_list ?? []) {
      total++;
      const info = a.address_info ?? {};
      const flags: string[] = [];
      if (isUnlimited(a.approved_amount)) flags.push('unlimited');
      if (Array.isArray(info.malicious_behavior) && info.malicious_behavior.length > 0) flags.push('malicious');
      if (info.doubt_list === 1) flags.push('flagged');
      if (info.is_contract === 1 && info.trust_list !== 1 && !info.tag) flags.push('unverified');
      if (flags.length) {
        risky.push({
          token: t.token_address ?? '',
          tokenSymbol: t.token_symbol,
          spender: a.approved_contract ?? '',
          spenderTag: info.tag,
          amount: a.approved_amount ?? '',
          flags,
        });
      }
    }
  }
  // most dangerous first
  risky.sort((x, y) => (y.flags.includes('malicious') ? 1 : 0) - (x.flags.includes('malicious') ? 1 : 0));
  return { wallet, chain, supported: true, totalApprovals: total, risky };
}
