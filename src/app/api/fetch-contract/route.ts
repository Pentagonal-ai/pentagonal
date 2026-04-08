import { NextRequest, NextResponse } from 'next/server';
import { CHAINS } from '@/lib/types';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1, polygon: 137, arbitrum: 42161,
  base: 8453, optimism: 10, bsc: 56, avalanche: 43114,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type DexPair = {
  chainId?: string;
  dexId: string; pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
  fdv?: number; marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string; label: string }[];
    socials?: { url: string; type: string }[];
  };
};

type RugcheckReport = {
  creator?: string;
  creatorBalance?: number;
  totalHolders?: number;
  totalLPProviders?: number;
  totalMarketLiquidity?: number;
  lpLockedPct?: number;
  rugged?: boolean;
  launchpad?: { name: string; platform: string };
  graphInsidersDetected?: number;
  insiderNetworks?: { id: string; size: number; type: string; tokenAmount: number }[];
  score?: number;
  score_normalised?: number;
  risks?: { name: string; description: string; score: number; level: string }[];
  topHolders?: { address: string; pct: number; owner: string; insider: boolean; uiAmount: number }[];
  verification?: unknown;
  token?: { supply: number; mintAuthority: string | null; freezeAuthority: string | null };
  markets?: { lp?: { lpLockedPct: number; lpLockedUSD: number } }[];
};

type GoPlusToken = Record<string, unknown>;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

async function fetchDexScreener(address: string): Promise<DexPair[]> {
  try {
    const r = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/search?q=${address}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return ((d.pairs || []) as DexPair[]).filter(
      p => p.baseToken?.address === address || p.quoteToken?.address === address
    ).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  } catch { return []; }
}

async function fetchRugcheck(mint: string): Promise<RugcheckReport | null> {
  try {
    const r = await fetchWithTimeout(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
    if (!r.ok) return null;
    return await r.json() as RugcheckReport;
  } catch { return null; }
}

async function fetchGoPlus(address: string, chainId: number): Promise<GoPlusToken | null> {
  try {
    const r = await fetchWithTimeout(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const result = d?.result ?? {};
    const key = Object.keys(result)[0];
    return key ? result[key] as GoPlusToken : null;
  } catch { return null; }
}

// ─── ATH + URL helpers ────────────────────────────────────────────────────────

const GT_NETWORK_SLUGS: Record<string, string> = {
  solana: 'solana', ethereum: 'eth', bsc: 'bsc', polygon: 'polygon_pos',
  base: 'base', arbitrum: 'arbitrum', optimism: 'optimism', avalanche: 'avax',
};

const EXPLORER_HOLDER_URLS: Record<string, string> = {
  solana:    'https://solscan.io/token/{address}#holders',
  ethereum:  'https://etherscan.io/token/{address}#balances',
  bsc:       'https://bscscan.com/token/{address}#balances',
  polygon:   'https://polygonscan.com/token/{address}#balances',
  base:      'https://basescan.org/token/{address}#balances',
  arbitrum:  'https://arbiscan.io/token/{address}#balances',
  optimism:  'https://optimistic.etherscan.io/token/{address}#balances',
  avalanche: 'https://snowtrace.io/token/{address}#balances',
};

const DEX_CHAIN_SLUGS: Record<string, string> = {
  solana: 'solana', ethereum: 'ethereum', bsc: 'bsc', polygon: 'polygon',
  base: 'base', arbitrum: 'arbitrum', optimism: 'optimism', avalanche: 'avalanche',
};

function buildDexUrl(chainId: string, address: string): string {
  return `https://dexscreener.com/${DEX_CHAIN_SLUGS[chainId] || chainId}/${address}`;
}

function buildHolderUrl(chainId: string, address: string): string | undefined {
  const tpl = EXPLORER_HOLDER_URLS[chainId];
  return tpl ? tpl.replace('{address}', address) : undefined;
}

type ATHResult = { athMarketCap: number | null; athMultiplier: number | null; athLabel: string };

async function fetchATH(
  gtNetwork: string | undefined,
  poolAddress: string | undefined,
  pairCreatedAt: number | undefined,
  currentMarketCap: number | undefined,
  contractAddress: string,
  cgPlatform: string | undefined,
): Promise<ATHResult> {
  const daysOld = pairCreatedAt ? (Date.now() - pairCreatedAt) / 86_400_000 : 999;
  const athLabel = daysOld > 365 ? 'ATH 1YR' : 'ATH';

  // Source 1: GeckoTerminal OHLCV
  if (gtNetwork && poolAddress) {
    try {
      const r = await fetchWithTimeout(
        `https://api.geckoterminal.com/api/v2/networks/${gtNetwork}/pools/${poolAddress}/ohlcv/day?limit=365&aggregate=1`,
        { headers: { Accept: 'application/json' } },
        6000,
      );
      if (r.ok) {
        const d = await r.json();
        const candles = d?.data?.attributes?.ohlcv_list;
        if (Array.isArray(candles) && candles.length > 0) {
          // Each candle: [timestamp, open, high, low, close, volume]
          const athPrice = Math.max(...candles.map((c: number[]) => c[2]));
          // Try to compute MC from price — use fdv or mc from dexscreener as proxy
          if (currentMarketCap && currentMarketCap > 0) {
            const currentPrice = candles[0]?.[4] || 1;
            const impliedSupply = currentMarketCap / currentPrice;
            const athMC = athPrice * impliedSupply;
            return {
              athMarketCap: athMC,
              athMultiplier: athMC > 0 && currentMarketCap > 0 ? athMC / currentMarketCap : null,
              athLabel,
            };
          }
        }
      }
    } catch { /* GT failed, try CoinGecko */ }
  }

  // Source 2: CoinGecko contract market_chart
  if (cgPlatform) {
    try {
      const r = await fetchWithTimeout(
        `https://api.coingecko.com/api/v3/coins/${cgPlatform}/contract/${contractAddress}/market_chart?vs_currency=usd&days=365`,
        { headers: { Accept: 'application/json' } },
        6000,
      );
      if (r.ok) {
        const d = await r.json();
        const mcs = d?.market_caps;
        if (Array.isArray(mcs) && mcs.length > 0) {
          const athMC = Math.max(...mcs.map((m: number[]) => m[1]));
          return {
            athMarketCap: athMC,
            athMultiplier: athMC > 0 && currentMarketCap && currentMarketCap > 0 ? athMC / currentMarketCap : null,
            athLabel,
          };
        }
      }
    } catch { /* CoinGecko also failed */ }
  }

  return { athMarketCap: null, athMultiplier: null, athLabel };
}

const CG_PLATFORMS: Record<string, string> = {
  ethereum: 'ethereum', bsc: 'binance-smart-chain', polygon: 'polygon-pos',
  base: 'base', arbitrum: 'arbitrum-one', optimism: 'optimistic-ethereum', avalanche: 'avalanche',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_MAP: Record<string, { name: string; type: string }> = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { name: 'Raydium AMM v4',      type: 'amm_pool' },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': { name: 'Raydium CLMM',        type: 'clmm_pool' },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc':  { name: 'Orca Whirlpool',      type: 'clmm_pool' },
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': { name: 'Orca AMM',            type: 'amm_pool' },
  'LBUZKhRxPF3XUpBCjp4YzTKgLe4rvxjH1AzEHgBQA5':  { name: 'Meteora DLMM',        type: 'dlmm_pool' },
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': { name: 'Meteora Dynamic AMM', type: 'amm_pool' },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4':  { name: 'Jupiter v6',          type: 'aggregator' },
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA':  { name: 'pump.fun AMM',        type: 'amm_pool' },
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P':  { name: 'pump.fun Bonding',    type: 'bonding_curve' },
  'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo':  { name: 'Solend',              type: 'lending' },
  'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68':  { name: 'Marginfi',            type: 'lending' },
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD':  { name: 'Marinade',            type: 'liquid_staking' },
  'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S': { name: 'Lifinity',            type: 'amm_pool' },
};

const DANGEROUS_EXTENSIONS: Record<string, string> = {
  permanentDelegate:     'CRITICAL: Can transfer tokens from any wallet without consent',
  transferHook:          'HIGH: Calls external program on every transfer (potential rug hook)',
  transferFeeConfig:     'MEDIUM: Applies a fee to every transfer',
  mintCloseAuthority:    'HIGH: Can close the mint account, destroying all token supply',
  nonTransferable:       'LOW: Tokens are soul-bound and cannot be transferred',
  interestBearingConfig: 'LOW: Dynamically adjusts displayed supply via interest accrual',
};

const liqRisk = (usd: number) =>
  usd < 10_000    ? 'CRITICAL — trivially manipulable' :
  usd < 100_000   ? 'HIGH — flash loan manipulation risk' :
  usd < 1_000_000 ? 'MEDIUM — significant capital required' :
                    'LOW — deep liquidity';

// ─── Profile builders ─────────────────────────────────────────────────────────

const buildPoolProfile = (pair: DexPair, ownerProtocol?: string): string => {
  const liqUsd  = pair.liquidity?.usd ?? 0;
  const vol24h  = pair.volume?.h24 ?? 0;
  const protocol = ownerProtocol || pair.dexId || 'Unknown';
  const ageMs   = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null;
  const ageDays = ageMs ? Math.floor(ageMs / 86_400_000) : null;
  const ch24    = pair.priceChange?.h24 ?? 0;
  const ch1     = pair.priceChange?.h1  ?? 0;
  const txns    = pair.txns?.h24 || { buys: 0, sells: 0 };
  const bsr     = txns.sells && txns.buys ? (txns.buys / (txns.buys + txns.sells) * 100).toFixed(1) : 'N/A';
  return [
    `// ─── DeFi Pool Security Analysis ───`,
    `// Pool: ${pair.pairAddress}  Protocol: ${protocol}`,
    `// Source: DexScreener + Solana Mainnet RPC`, ``,
    `const POOL_ADDRESS  = "${pair.pairAddress}";`,
    `const BASE_TOKEN    = "${pair.baseToken.address}"; // ${pair.baseToken.name} (${pair.baseToken.symbol})`,
    `const QUOTE_TOKEN   = "${pair.quoteToken.address}"; // ${pair.quoteToken.name} (${pair.quoteToken.symbol})`,
    `const PRICE_USD     = ${pair.priceUsd ?? 'null'};`, ``,
    `// ─── Liquidity & Volume ───`,
    `const LIQUIDITY_USD = ${liqUsd.toFixed(2)}; // Risk: ${liqRisk(liqUsd)}`,
    `const VOLUME_24H    = ${vol24h.toFixed(2)};`,
    `const VOL_LIQ_RATIO = ${liqUsd > 0 ? (vol24h / liqUsd).toFixed(2) : 'N/A'}; // ${vol24h / (liqUsd || 1) > 10 ? 'WARNING: High V/L — possible wash trading' : 'Normal'}`, ``,
    `const PRICE_CHANGE_1H  = "${ch1}%"; // ${Math.abs(ch1) > 50 ? 'WARNING: Extreme volatility' : 'Normal'}`,
    `const PRICE_CHANGE_24H = "${ch24}%"; // ${ch24 < -50 ? 'CRITICAL: Possible rug' : ch24 > 200 ? 'WARNING: Possible pump' : 'Normal'}`,
    `const BUY_RATIO_PCT   = "${bsr}"; // ${Number(bsr) > 80 ? 'WARNING: Coordinated pump pattern' : Number(bsr) < 20 ? 'WARNING: Exit event' : 'Normal'}`,
    ageDays !== null ? `const POOL_AGE_DAYS = ${ageDays}; // ${ageDays < 1 ? 'HIGH: < 24h old' : ageDays < 7 ? 'MEDIUM: < 1 week' : 'Established'}` : '',
    pair.marketCap ? `const MARKET_CAP = ${pair.marketCap};` : '',
  ].filter(Boolean).join('\n');
};

function buildSolanaTokenProfile(
  address: string,
  mint: Record<string, unknown>,
  tokenProgram: string,
  extensions: string[],
  metadata: Record<string, unknown> | undefined,
  isPumpFun: boolean,
  pairs: DexPair[],
  rc: RugcheckReport | null,
): string {
  const flaggedExts = extensions.filter(e => DANGEROUS_EXTENSIONS[e]);
  const info = pairs[0]?.info;
  const website  = info?.websites?.[0]?.url ?? null;
  const twitter  = info?.socials?.find(s => s.type === 'twitter')?.url ?? null;
  const telegram = info?.socials?.find(s => s.type === 'telegram')?.url ?? null;
  const totalLiq = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);

  // Rugcheck-derived values
  const rugged     = rc?.rugged ?? false;
  const rugScore   = rc?.score_normalised ?? 'N/A';
  const launchpad  = rc?.launchpad?.name ?? (isPumpFun ? 'pump.fun' : 'Unknown');
  const creator    = rc?.creator ?? 'Unknown';
  const totalHolders    = rc?.totalHolders ?? 'N/A';
  const totalLPProviders = rc?.totalLPProviders ?? 'N/A';
  const insidersDetected = rc?.graphInsidersDetected ?? 0;
  const insiderNets      = rc?.insiderNetworks ?? [];
  const lpLockedPct      = rc?.markets?.[0]?.lp?.lpLockedPct ?? 'N/A';
  const topHolders       = rc?.topHolders ?? [];
  const rcRisks          = rc?.risks ?? [];

  // Compute creator balance %
  const supply = Number(mint.supply) || 0;
  const creatorBalRaw = rc?.creatorBalance ?? 0;
  const creatorPct = supply > 0 ? ((creatorBalRaw / supply) * 100).toFixed(2) : 'N/A';

  // Top holder concentration
  const top10pct = topHolders.slice(0, 10).reduce((s, h) => s + h.pct, 0);

  const lines: string[] = [
    `// ─── PENTAGONAL SOLANA TOKEN INTELLIGENCE REPORT ───`,
    `// Sources: Solana RPC + DexScreener + Rugcheck`,
    `// Mint: ${address}`,
    `// Token Standard: ${tokenProgram === 'spl-token-2022' ? 'SPL Token-2022 (with extensions)' : 'SPL Token (legacy)'}`,
    ``,
    `const MINT    = "${address}";`,
    `const NAME    = "${(metadata?.name as string) || 'Unknown'}";`,
    `const SYMBOL  = "${(metadata?.symbol as string) || '?'}";`,
    `const DECIMALS = ${mint.decimals};`,
    `const SUPPLY  = ${supply};`,
    `const LAUNCHPAD = "${launchpad}";`,
    rugged ? `const RUGGED = true; // 🔴 CRITICAL: This token has already been rugged` : `const RUGGED = false;`,
    `const RUGCHECK_SCORE = ${rugScore}; // normalised 0–100, lower = safer`,
    ``,
    `// ─── Authority Settings ───`,
    `const MINT_AUTHORITY   = ${mint.mintAuthority   ? `"${mint.mintAuthority}"`   : 'null'}; // ${mint.mintAuthority   ? 'WARNING: Owner can mint unlimited tokens' : '✅ Supply is permanently fixed'}`,
    `const FREEZE_AUTHORITY = ${mint.freezeAuthority ? `"${mint.freezeAuthority}"` : 'null'}; // ${mint.freezeAuthority ? 'WARNING: Owner can freeze accounts'       : '✅ Safe'}`,
    `const UPDATE_AUTHORITY = ${metadata?.updateAuthority ? `"${metadata.updateAuthority}"` : 'null'}; // ${metadata?.updateAuthority ? 'WARNING: Metadata can be changed' : '✅ Metadata is immutable'}`,
    ``,
  ];

  if (extensions.length > 0) {
    lines.push(`// ─── Token-2022 Extensions ───`);
    extensions.forEach(e => lines.push(
      `const EXT_${e.replace(/([A-Z])/g, '_$1').toUpperCase()} = true; // ${DANGEROUS_EXTENSIONS[e] || 'Informational'}`
    ));
    lines.push('');
  }

  lines.push(
    `// ─── Creator Intelligence ───`,
    `const CREATOR             = "${creator}";`,
    `const CREATOR_BALANCE_PCT = "${creatorPct}%"; // ${Number(creatorPct) > 10 ? '⚠️ HIGH: Creator holds significant supply' : Number(creatorPct) > 3 ? '⚠️ MEDIUM: Creator still holds tokens' : '✅ Low creator exposure'}`,
    ``,
    `// ─── Holder Distribution ───`,
    `const TOTAL_HOLDERS   = ${totalHolders}; // ${typeof totalHolders === 'number' && totalHolders < 500 ? '⚠️ HIGH: Very few holders' : ''}`,
    `const TOP_10_COMBINED = "${top10pct.toFixed(1)}%"; // ${top10pct > 80 ? '🔴 CRITICAL: Extreme concentration' : top10pct > 60 ? '⚠️ HIGH: Concentrated supply' : '✅ Reasonable distribution'}`,
  );
  topHolders.slice(0, 8).forEach((h, i) => lines.push(
    `const HOLDER_${i + 1} = { pct: ${h.pct.toFixed(2)}, owner: "${h.owner}", insider: ${h.insider} };${h.insider ? ' // ⚠️ INSIDER' : ''}`
  ));
  lines.push('');

  if (insidersDetected > 0 || insiderNets.length > 0) {
    lines.push(
      `// ─── Insider Network Analysis ───`,
      `const INSIDER_WALLETS_DETECTED = ${insidersDetected}; // ${insidersDetected > 5 ? '🔴 CRITICAL: Large coordinated cluster' : '⚠️ HIGH: Insider coordination found'}`,
    );
    insiderNets.forEach((n, i) => lines.push(
      `const INSIDER_NET_${i + 1} = { size: ${n.size}, type: "${n.type}", tokenAmount: ${n.tokenAmount} };`
    ));
    lines.push('');
  }

  lines.push(
    `// ─── Liquidity & LP Analysis ───`,
    `const TOTAL_LIQUIDITY_USD  = ${totalLiq.toFixed(2)}; // Risk: ${liqRisk(totalLiq)}`,
    `const LP_LOCKED_PCT        = ${lpLockedPct}; // ${lpLockedPct === 100 ? '✅ Fully locked' : typeof lpLockedPct === 'number' && lpLockedPct < 50 ? '⚠️ HIGH: Over 50% of LP is unlocked — rug risk' : ''}`,
    `const TOTAL_LP_PROVIDERS   = ${totalLPProviders}; // ${typeof totalLPProviders === 'number' && totalLPProviders < 3 ? '⚠️ HIGH: Very few LP providers' : ''}`,
  );
  pairs.slice(0, 5).forEach((p, i) => lines.push(
    `const PAIR_${i + 1} = { dex: "${p.dexId}", address: "${p.pairAddress}", liq: ${(p.liquidity?.usd ?? 0).toFixed(0)}, vol24h: ${(p.volume?.h24 ?? 0).toFixed(0)}, ch24: "${p.priceChange?.h24 ?? '?'}%" };`
  ));

  if (website || twitter || telegram) {
    lines.push(
      ``,
      `// ─── Social Presence ───`,
      website  ? `const WEBSITE  = "${website}";`  : '',
      twitter  ? `const TWITTER  = "${twitter}";`  : '',
      telegram ? `const TELEGRAM = "${telegram}";` : '',
    );
  }

  if (rcRisks.length > 0) {
    lines.push(``, `// ─── Rugcheck Risk Findings ───`);
    rcRisks.forEach((r, i) => lines.push(
      `const RISK_${i + 1} = { level: "${r.level}", name: "${r.name}", score: ${r.score} }; // ${r.description}`
    ));
  }

  if (flaggedExts.length > 0) {
    lines.push(``, `// ⚠️  DANGEROUS EXTENSIONS DETECTED`);
    flaggedExts.forEach(e => lines.push(`// ⚠️  ${e}: ${DANGEROUS_EXTENSIONS[e]}`));
  }

  if (isPumpFun) {
    lines.push(``, `// ─── pump.fun Notes ───`,
      `// Bonding curve: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`,
      `// Graduates to Raydium/PumpSwap at ~$69K market cap.`,
    );
  }

  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

function buildEvmTokenProfile(
  address: string,
  chainName: string,
  gp: GoPlusToken,
  pairs: DexPair[],
): string {
  const bool = (v: unknown) => v === '1' || v === 1 || v === true;
  const pct  = (v: unknown) => (parseFloat(String(v || '0')) * 100).toFixed(4);

  const isHoneypot  = bool(gp.is_honeypot);
  const buyTax      = parseFloat(String(gp.buy_tax  || '0')) * 100;
  const sellTax     = parseFloat(String(gp.sell_tax || '0')) * 100;
  const isMintable  = bool(gp.is_mintable);
  const isPausable  = bool(gp.transfer_pausable);
  const isBlacklist = bool(gp.is_blacklisted);
  const canTakeBack = bool(gp.can_take_back_ownership);
  const hiddenOwner = bool(gp.hidden_owner);
  const isProxy     = bool(gp.is_proxy);
  const hasSelfDestr = bool(gp.selfdestruct);
  const cooldown    = bool(gp.trading_cooldown);
  const honeypotSameCreator = bool(gp.honeypot_with_same_creator);
  const holderCount = parseInt(String(gp.holder_count || '0'));
  const ownerPct    = parseFloat(String(gp.owner_percent || '0')) * 100;

  const info        = pairs[0]?.info;
  const totalLiq    = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
  const website     = info?.websites?.[0]?.url ?? null;
  const twitter     = info?.socials?.find(s => s.type === 'twitter')?.url ?? null;
  const telegram    = info?.socials?.find(s => s.type === 'telegram')?.url ?? null;

  const holders    = (gp.holders as Array<{ address: string; percent: string; is_contract: number; is_locked: number; tag?: string }>) || [];
  const lpHolders  = (gp.lp_holders as Array<{ address: string; percent: string; is_locked: number; tag?: string }>) || [];
  const top10pct   = holders.slice(0, 10).reduce((s, h) => s + parseFloat(h.percent || '0'), 0) * 100;
  const lpUnlocked = lpHolders.filter(h => h.is_locked !== 1).reduce((s, h) => s + parseFloat(h.percent || '0'), 0) * 100;

  const lines = [
    `// ─── PENTAGONAL EVM TOKEN INTELLIGENCE REPORT ───`,
    `// Sources: GoPlus Security + DexScreener`,
    `// Contract: ${address}  Chain: ${chainName}`, ``,
    `const TOKEN_NAME   = "${gp.token_name || 'Unknown'}";`,
    `const TOKEN_SYMBOL = "${gp.token_symbol || '?'}";`,
    `const TOTAL_SUPPLY = "${gp.total_supply || 'Unknown'}";`, ``,
    `// ─── Honeypot & Tax Analysis ───`,
    `const IS_HONEYPOT  = ${isHoneypot}; // ${isHoneypot ? '🔴 CRITICAL: Tokens CANNOT be sold!' : '✅ Sell function works'}`,
    `const BUY_TAX      = "${buyTax.toFixed(1)}%"; // ${buyTax > 10 ? '⚠️ HIGH: Excessive buy tax' : '✅'}`,
    `const SELL_TAX     = "${sellTax.toFixed(1)}%"; // ${sellTax > 10 ? '⚠️ HIGH: Sell tax is a red flag' : '✅'}`,
    honeypotSameCreator ? `const HONEYPOTS_SAME_CREATOR = true; // 🔴 CRITICAL: Creator has deployed known honeypots` : '',
    ``,
    `// ─── Contract Permissions (Rug Vectors) ───`,
    `const IS_MINTABLE          = ${isMintable}; // ${isMintable ? '⚠️ HIGH: Owner can mint unlimited tokens' : '✅'}`,
    `const TRANSFER_PAUSABLE    = ${isPausable}; // ${isPausable ? '⚠️ HIGH: Owner can freeze all transfers' : '✅'}`,
    `const CAN_TAKE_BACK_OWNER  = ${canTakeBack}; // ${canTakeBack ? '⚠️ HIGH: Ownership renouncement is reversible' : '✅'}`,
    `const HIDDEN_OWNER         = ${hiddenOwner}; // ${hiddenOwner ? '🔴 CRITICAL: Obfuscated ownership structure' : '✅'}`,
    `const IS_BLACKLISTED       = ${isBlacklist}; // ${isBlacklist ? '⚠️ MEDIUM: Blacklist can block wallets from trading' : '✅'}`,
    `const IS_PROXY             = ${isProxy}; // ${isProxy ? '⚠️ MEDIUM: Implementation can be swapped' : '✅'}`,
    `const SELF_DESTRUCT        = ${hasSelfDestr}; // ${hasSelfDestr ? '🔴 CRITICAL: Contract can be destroyed' : '✅'}`,
    `const TRADING_COOLDOWN     = ${cooldown}; // ${cooldown ? '⚠️ LOW: Cooldown between trades' : '✅'}`,
    ``,
    `// ─── Ownership ───`,
    `const OWNER_ADDRESS        = "${gp.owner_address || 'N/A'}";`,
    `const OWNER_SUPPLY_PCT     = "${ownerPct.toFixed(4)}%"; // ${ownerPct > 5 ? '⚠️ HIGH: Owner controls significant supply' : '✅'}`,
    `const CREATOR_ADDRESS      = "${gp.creator_address || 'N/A'}";`,
    `const CREATOR_SUPPLY_PCT   = "${pct(gp.creator_percent)}%";`,
    ``,
    `// ─── Holder Distribution ───`,
    `const TOTAL_HOLDERS        = ${holderCount}; // ${holderCount < 100 ? '⚠️ HIGH: Very few holders' : '✅'}`,
    `const TOP_10_COMBINED_PCT  = "${top10pct.toFixed(1)}%"; // ${top10pct > 80 ? '🔴 CRITICAL: Extreme concentration' : top10pct > 60 ? '⚠️ HIGH: Concentrated' : '✅'}`,
  ];

  holders.slice(0, 8).forEach((h, i) => {
    const p = (parseFloat(h.percent || '0') * 100).toFixed(2);
    const tag = h.tag ? ` [${h.tag}]` : '';
    const locked = h.is_locked === 1 ? ' [LOCKED]' : '';
    const contract = h.is_contract === 1 ? ' [CONTRACT]' : '';
    lines.push(`const HOLDER_${i + 1} = { pct: "${p}%", address: "${h.address}"${tag}${locked}${contract} };`);
  });

  lines.push(``,
    `// ─── LP Security ───`,
    `const LP_HOLDER_COUNT = ${gp.lp_holder_count || 'N/A'};`,
    `const LP_UNLOCKED_PCT = "${lpUnlocked.toFixed(1)}%"; // ${lpUnlocked > 50 ? '⚠️ HIGH: Over half LP is unlocked — rug risk' : '✅'}`,
  );
  lpHolders.slice(0, 3).forEach((h, i) => {
    const p = (parseFloat(h.percent || '0') * 100).toFixed(2);
    const tag = h.tag ? ` [${h.tag}]` : '';
    lines.push(`const LP_HOLDER_${i + 1} = { pct: "${p}%", address: "${h.address}"${tag}, locked: ${h.is_locked === 1} };`);
  });

  if (totalLiq > 0 || pairs.length > 0) {
    lines.push(``,
      `// ─── Market Data ───`,
      `const TOTAL_LIQUIDITY_USD = ${totalLiq.toFixed(2)}; // Risk: ${liqRisk(totalLiq)}`,
    );
    pairs.slice(0, 5).forEach((p, i) => lines.push(
      `const PAIR_${i + 1} = { dex: "${p.dexId}", liq: ${(p.liquidity?.usd ?? 0).toFixed(0)}, vol24h: ${(p.volume?.h24 ?? 0).toFixed(0)}, ch24: "${p.priceChange?.h24 ?? '?'}%" };`
    ));
  }

  if (website || twitter || telegram) {
    lines.push(``, `// ─── Social Presence ───`);
    if (website)  lines.push(`const WEBSITE  = "${website}";`);
    if (twitter)  lines.push(`const TWITTER  = "${twitter}";`);
    if (telegram) lines.push(`const TELEGRAM = "${telegram}";`);
  } else {
    lines.push(``, `// ─── Social Presence ───`, `// ⚠️ MEDIUM: No social links found on DexScreener`);
  }

  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

function buildEvmEnrichmentHeader(gp: GoPlusToken, pairs: DexPair[]): string {
  const bool = (v: unknown) => v === '1' || v === 1 || v === true;
  const isHoneypot  = bool(gp.is_honeypot);
  const buyTax      = parseFloat(String(gp.buy_tax  || '0')) * 100;
  const sellTax     = parseFloat(String(gp.sell_tax || '0')) * 100;
  const isMintable  = bool(gp.is_mintable);
  const isPausable  = bool(gp.transfer_pausable);
  const hiddenOwner = bool(gp.hidden_owner);
  const canTakeBack = bool(gp.can_take_back_ownership);
  const holderCount = parseInt(String(gp.holder_count || '0'));
  const ownerPct    = parseFloat(String(gp.owner_percent || '0')) * 100;
  const info        = pairs[0]?.info;
  const totalLiq    = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
  const holders     = (gp.holders as Array<{ address: string; percent: string; is_contract: number; is_locked: number; tag?: string }>) || [];
  const lpHolders   = (gp.lp_holders as Array<{ address: string; percent: string; is_locked: number }>) || [];
  const top10pct    = holders.slice(0, 10).reduce((s, h) => s + parseFloat(h.percent || '0'), 0) * 100;
  const lpUnlocked  = lpHolders.filter(h => h.is_locked !== 1).reduce((s, h) => s + parseFloat(h.percent || '0'), 0) * 100;

  const lines = [
    `/**`,
    ` * ─── PENTAGONAL EVM TOKEN INTELLIGENCE ───`,
    ` * Sources: GoPlus Security + DexScreener (real-time)`,
    ` * IS_HONEYPOT: ${isHoneypot}${isHoneypot ? ' ← 🔴 CRITICAL: Cannot sell!' : ''}`,
    ` * BUY_TAX: ${buyTax.toFixed(1)}%${buyTax > 10 ? ' ← ⚠️ HIGH' : ''}  SELL_TAX: ${sellTax.toFixed(1)}%${sellTax > 10 ? ' ← ⚠️ HIGH' : ''}`,
    ` * IS_MINTABLE: ${isMintable}${isMintable ? ' ← ⚠️ HIGH: Unlimited mint' : ''}`,
    ` * TRANSFER_PAUSABLE: ${isPausable}${isPausable ? ' ← ⚠️ HIGH: Can freeze transfers' : ''}`,
    ` * HIDDEN_OWNER: ${hiddenOwner}${hiddenOwner ? ' ← 🔴 CRITICAL' : ''}`,
    ` * CAN_TAKE_BACK_OWNERSHIP: ${canTakeBack}${canTakeBack ? ' ← ⚠️ HIGH' : ''}`,
    ` * OWNER: ${gp.owner_address || 'N/A'} (${ownerPct.toFixed(2)}% of supply)`,
    ` * TOTAL_HOLDERS: ${holderCount}  TOP_10_CONCENTRATION: ${top10pct.toFixed(1)}%`,
  ];

  if (holders.length > 0) {
    holders.slice(0, 5).forEach((h, i) => {
      const p = (parseFloat(h.percent || '0') * 100).toFixed(2);
      lines.push(` * HOLDER_${i + 1}: ${h.address} — ${p}%${h.is_locked === 1 ? ' [LOCKED]' : ''}`);
    });
  }

  lines.push(
    ` * LP_UNLOCKED_PCT: ${lpUnlocked.toFixed(1)}%${lpUnlocked > 50 ? ' ← ⚠️ HIGH: Rug risk' : ''}`,
    ` * LIQUIDITY_USD: $${totalLiq.toLocaleString()} (${liqRisk(totalLiq)})`,
  );

  if (info?.websites?.[0]) lines.push(` * WEBSITE: ${info.websites[0].url}`);
  info?.socials?.forEach(s => lines.push(` * ${s.type.toUpperCase()}: ${s.url}`));
  lines.push(` */`, ``);

  return lines.join('\n');
}

// ─── EVM token info builder (for preview card) ────────────────────────────────

function buildEvmTokenInfo(gp: GoPlusToken, pairs: DexPair[], chainId: string, address: string, ath: ATHResult) {
  const bool = (v: unknown) => v === '1' || v === 1 || v === true;
  const toNum = (v: unknown) => parseFloat(String(v || '0'));
  const info = pairs[0]?.info;
  const topPair = pairs[0];
  const totalLiq = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
  const holders = (gp.lp_holders as Array<{ percent: string; is_locked: number }> | undefined) ?? [];
  const lpUnlocked = holders.filter(h => h.is_locked !== 1).reduce((s, h) => s + toNum(h.percent), 0) * 100;

  return {
    name: String(gp.token_name || ''),
    symbol: String(gp.token_symbol || ''),
    imageUrl: info?.imageUrl,
    // Market data
    priceUsd: topPair?.priceUsd,
    priceChange24h: topPair?.priceChange?.h24,
    volume24h: topPair?.volume?.h24,
    txns24h: (topPair?.txns?.h24?.buys ?? 0) + (topPair?.txns?.h24?.sells ?? 0),
    buys24h: topPair?.txns?.h24?.buys,
    sells24h: topPair?.txns?.h24?.sells,
    marketCap: topPair?.marketCap ?? topPair?.fdv,
    url: topPair ? `https://dexscreener.com/${topPair.chainId ?? DEX_CHAIN_SLUGS[chainId] ?? 'ethereum'}/${topPair.pairAddress}` : undefined,
    dexUrl: buildDexUrl(chainId, address),
    holderUrl: buildHolderUrl(chainId, address),
    // ATH
    athMarketCap: ath.athMarketCap,
    athMultiplier: ath.athMultiplier,
    athLabel: ath.athLabel,
    // Socials
    website: info?.websites?.[0]?.url,
    twitter: info?.socials?.find(s => s.type === 'twitter')?.url,
    telegram: info?.socials?.find(s => s.type === 'telegram')?.url,
    // Pool & liquidity
    liquidity: totalLiq,
    dexName: topPair?.dexId,
    pairCount: pairs.length,
    // GoPlus security
    totalHolders: gp.holder_count ? parseInt(String(gp.holder_count)) : undefined,
    isHoneypot: bool(gp.is_honeypot),
    buyTax: toNum(gp.buy_tax) * 100,
    sellTax: toNum(gp.sell_tax) * 100,
    isMintable: bool(gp.is_mintable),
    isPausable: bool(gp.transfer_pausable),
    hiddenOwner: bool(gp.hidden_owner),
    canTakeBack: bool(gp.can_take_back_ownership),
    selfDestruct: bool(gp.selfdestruct),
    ownerPct: toNum(gp.owner_percent) * 100,
    lpUnlockedPct: lpUnlocked,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth waterfall ──────────────────────────────────────────────────────────
  //
  // Priority:
  //   1. Admin MCP key (x-pentagonal-key)  → unlimited bypass
  //   2. User API key (x-pentagonal-api-key) → utility rate limit (Phase 3)
  //   3. Cookie session → utility rate limit
  //   4. No auth (public) → IP rate limit at 1 req/min with countdown message
  //
  const mcpKey = req.headers.get('x-pentagonal-key');
  const validMcpKey = process.env.PENTAGONAL_MCP_KEY;
  const isMcpCall = validMcpKey && mcpKey === validMcpKey;

  // Tier 2: per-user API key (Phase 3 — key resolution not yet built, placeholder)
  const userApiKey = req.headers.get('x-pentagonal-api-key');
  const isApiKeyCall = Boolean(userApiKey); // TODO: validate against api_keys table in Phase 3

  if (!isMcpCall && !isApiKeyCall) {
    const auth = await requireAuth().catch(() => null);

    if (auth && !(auth instanceof NextResponse)) {
      // Tier 3: authenticated session
      const limited = checkRateLimit(auth.user.id, 'utility');
      if (limited) return limited;
    } else {
      // Tier 4: anonymous public — IP-keyed, 1 req/min, human-readable countdown
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';
      const limited = checkRateLimit(`anon:${ip}`, 'public');
      if (limited) return limited;
    }
  }

  try {
    const body = await req.json();
    const { address, chainId } = body;

    if (!address || typeof address !== 'string' || !chainId || typeof chainId !== 'string') {
      return NextResponse.json({ error: 'Address and chain are required' }, { status: 400 });
    }

    const chain = CHAINS.find(c => c.id === chainId);
    if (!chain) return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });

    if (chain.type === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
        return NextResponse.json({ error: 'Invalid Solana address format' }, { status: 400 });
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address))
        return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SOLANA PATH
    // ═══════════════════════════════════════════════════════════════════════════
    if (chain.type === 'solana') {
      let solCode = '';
      let solName = `Program_${address.slice(0, 8)}`;

      // Strategy 0a: Classify account via RPC
      let rpcInfo: { executable: boolean; owner: string; data: { parsed?: { type: string; info: Record<string, unknown>; program?: string }; program?: string } | null } | null = null;
      try {
        const rpcRes = await fetchWithTimeout('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [address, { encoding: 'jsonParsed' }] }),
        });
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          rpcInfo = rpcData?.result?.value ?? null;
        }
      } catch { /* RPC timeout, fall through */ }

      // Path A: SPL Token Mint — parallel enrich with Rugcheck + DexScreener
      if (rpcInfo && !rpcInfo.executable && rpcInfo.data?.parsed?.type === 'mint') {
        const mint = rpcInfo.data.parsed.info;
        const tokenProgram = rpcInfo.data.parsed.program || rpcInfo.data.program || 'spl-token';
        const extensions: string[] = ((mint.extensions as { extension: string }[] | undefined) || []).map(e => e.extension);
        const metadata = (mint.extensions as { extension: string; state: Record<string, unknown> }[] | undefined)
          ?.find(e => e.extension === 'tokenMetadata')?.state;
        const isPumpFun = address.endsWith('pump');

        // Parallel fetch — all optional, never block
        const [rcResult, dexResult] = await Promise.allSettled([
          fetchRugcheck(address),
          fetchDexScreener(address),
        ]);
        const rc   = rcResult.status   === 'fulfilled' ? rcResult.value   : null;
        const pairs = dexResult.status === 'fulfilled' ? dexResult.value  : [];

        // ATH — runs after pairs are available (needs pool address + MC)
        const topPair = pairs[0];
        const currentMC = topPair?.marketCap ?? topPair?.fdv;
        const ath = await fetchATH(
          GT_NETWORK_SLUGS['solana'],
          topPair?.pairAddress,
          topPair?.pairCreatedAt,
          currentMC,
          address,
          undefined, // no CoinGecko platform for Solana SPL tokens
        );

        const tokenName = (metadata?.name as string) || (rc as RugcheckReport | null)?.token as unknown as string || solName;

        solCode = buildSolanaTokenProfile(address, mint, tokenProgram, extensions, metadata, isPumpFun, pairs, rc);

        return NextResponse.json({
          name: (metadata?.name as string) || solName,
          code: solCode,
          compiler: tokenProgram === 'spl-token-2022' ? 'SPL Token-2022' : 'SPL Token',
          chain: 'Solana',
          address,
          verified: false,
          tokenInfo: {
            name: (metadata?.name as string) || String(tokenName),
            symbol: (metadata?.symbol as string) || '?',
            imageUrl: topPair?.info?.imageUrl,
            // Market data
            priceUsd: topPair?.priceUsd,
            priceChange24h: topPair?.priceChange?.h24,
            volume24h: topPair?.volume?.h24,
            txns24h: (topPair?.txns?.h24?.buys ?? 0) + (topPair?.txns?.h24?.sells ?? 0),
            buys24h: topPair?.txns?.h24?.buys,
            sells24h: topPair?.txns?.h24?.sells,
            marketCap: currentMC,
            url: topPair ? `https://dexscreener.com/solana/${topPair.pairAddress}` : undefined,
            dexUrl: buildDexUrl('solana', address),
            holderUrl: buildHolderUrl('solana', address),
            // ATH
            athMarketCap: ath.athMarketCap,
            athMultiplier: ath.athMultiplier,
            athLabel: ath.athLabel,
            // Socials
            website: topPair?.info?.websites?.[0]?.url,
            twitter: topPair?.info?.socials?.find(s => s.type === 'twitter')?.url,
            telegram: topPair?.info?.socials?.find(s => s.type === 'telegram')?.url,
            // Pool + liquidity
            liquidity: pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0),
            dexName: topPair?.dexId,
            pairCount: pairs.length,
            // Rugcheck
            rugScore: rc?.score_normalised,
            totalHolders: rc?.totalHolders,
            rugged: rc?.rugged,
            launchpad: rc?.launchpad?.name ?? (isPumpFun ? 'pump.fun' : undefined),
            lpLockedPct: rc?.markets?.[0]?.lp?.lpLockedPct,
            insidersDetected: rc?.graphInsidersDetected,
            creatorPct: rc && rc.creatorBalance != null && Number(mint.supply) > 0
              ? ((rc.creatorBalance / Number(mint.supply)) * 100).toFixed(2)
              : undefined,
          },
        });
      }

      // Path B: DeFi Pool — DexScreener pair lookup
      if (!rpcInfo?.executable) {
        try {
          const pairRes = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/pairs/solana/${address}`, {
            headers: { Accept: 'application/json' },
          });
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            const pair: DexPair | null = pairData.pairs?.[0] || pairData.pair || null;
            if (pair?.baseToken && pair?.quoteToken) {
              const ownerProtocol = rpcInfo?.owner ? PROTOCOL_MAP[rpcInfo.owner]?.name : undefined;
              return NextResponse.json({
                name: `${pair.baseToken.symbol}/${pair.quoteToken.symbol} (${pair.dexId})`,
                code: buildPoolProfile(pair, ownerProtocol),
                compiler: 'DexScreener / Solana RPC',
                chain: 'Solana',
                address,
                verified: false,
              });
            }
          }
        } catch { /* DexScreener failed */ }
      }

      // Strategies 1-3: Program source code
      try {
        const res = await fetchWithTimeout(`https://pro-api.solscan.io/v2.0/account/program_source?address=${address}`, {
          headers: { Accept: 'application/json', token: process.env.SOLSCAN_API_KEY || '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data?.source_code) { solCode = data.data.source_code; solName = data.data.program_name || solName; }
        }
      } catch { /* Solscan failed */ }

      if (!solCode) {
        try {
          const res = await fetchWithTimeout(`https://verify.osec.io/status/${address}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.is_verified && data?.repo_url) {
              const repoUrl = data.repo_url.replace('github.com', 'raw.githubusercontent.com').replace('/tree/', '/');
              const libRes = await fetch(`${repoUrl}/programs/${data.program_name || 'program'}/src/lib.rs`);
              if (libRes.ok) { solCode = await libRes.text(); solName = data.program_name || solName; }
            }
          }
        } catch { /* OtterSec failed */ }
      }

      if (!solCode) {
        try {
          const res = await fetchWithTimeout(`https://anchor.so/api/v1/idl/${address}`);
          if (res.ok) {
            const idl = await res.json();
            if (idl?.instructions || idl?.name) {
              solCode = `// ─── Anchor IDL for ${idl.name || address} ───\n// Full source unavailable.\n\n${JSON.stringify(idl, null, 2)}`;
              solName = idl.name || solName;
            }
          }
        } catch { /* Anchor IDL failed */ }
      }

      if (solCode) {
        return NextResponse.json({ name: solName, code: solCode, compiler: 'Anchor / Native', chain: 'Solana', address, verified: true });
      }

      return NextResponse.json({
        error: 'Program source not found. Verified source requires OtterSec or Solscan verification.',
      }, { status: 404 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVM PATH
    // ═══════════════════════════════════════════════════════════════════════════
    const numericChainId = CHAIN_IDS[chain.id];
    const apiKey = process.env.ETHERSCAN_API_KEY || '';

    // Fire GoPlus + DexScreener in parallel while source code fetch runs
    const [gpResult, dexResult] = await Promise.allSettled([
      fetchGoPlus(address, numericChainId),
      fetchDexScreener(address),
    ]);
    const gp   = gpResult.status   === 'fulfilled' ? gpResult.value   : null;
    const pairs = dexResult.status === 'fulfilled' ? dexResult.value  : [];

    // ATH — runs after pairs resolve (needs pool address + MC)
    const evmTopPair = pairs[0];
    const evmCurrentMC = evmTopPair?.marketCap ?? evmTopPair?.fdv;
    const evmAth = await fetchATH(
      GT_NETWORK_SLUGS[chain.id],
      evmTopPair?.pairAddress,
      evmTopPair?.pairCreatedAt,
      evmCurrentMC,
      address,
      CG_PLATFORMS[chain.id],
    );

    // If GoPlus says it's a token and no source needed, build token profile directly
    const isKnownToken = gp && (gp.token_name || gp.holder_count);

    let sourceCode = '';
    let contractName = '';
    let compilerVersion = '';

    // Strategy 1: Etherscan V2 unified API
    if (apiKey) {
      try {
        const v2Url = `https://api.etherscan.io/v2/api?chainid=${numericChainId}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
        const res = await fetch(v2Url);
        const data = await res.json();
        if (data.status === '1' && data.result?.[0]?.SourceCode) {
          sourceCode = data.result[0].SourceCode;
          contractName = data.result[0].ContractName || '';
          compilerVersion = data.result[0].CompilerVersion || '';
        }
      } catch { /* V2 failed */ }
    }

    // Strategy 2: Chain-specific Etherscan fallback
    if (!sourceCode && chain.explorerApi) {
      try {
        const url = `${chain.explorerApi}?module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === '1' && data.result?.[0]?.SourceCode) {
          sourceCode = data.result[0].SourceCode;
          contractName = data.result[0].ContractName || '';
          compilerVersion = data.result[0].CompilerVersion || '';
        }
      } catch { /* Chain-specific failed */ }
    }

    // Strategy 3: Sourcify
    if (!sourceCode && numericChainId) {
      try {
        const res = await fetch(`https://sourcify.dev/server/files/${numericChainId}/${address}`);
        if (res.ok) {
          const files = await res.json();
          if (Array.isArray(files) && files.length > 0) {
            const solFiles = files.filter((f: { name: string }) => f.name?.endsWith('.sol'));
            if (solFiles.length > 0) {
              sourceCode = solFiles.map((f: { name: string; content: string }) => `// ─── ${f.name} ───\n${f.content}`).join('\n\n');
              contractName = solFiles[0]?.name?.replace('.sol', '') || '';
            }
          }
        }
      } catch { /* Sourcify failed */ }
    }

    // Source found: prepend GoPlus/DexScreener intelligence header then return enriched source
    if (sourceCode) {
      const enriched = gp
        ? buildEvmEnrichmentHeader(gp, pairs) + parseSourceCode(sourceCode)
        : parseSourceCode(sourceCode);

      return NextResponse.json({
        name: contractName || `Contract_${address.slice(0, 8)}`,
        code: enriched,
        compiler: compilerVersion || 'Unknown',
        chain: chain.name,
        address,
        verified: true,
        tokenInfo: gp && isKnownToken ? buildEvmTokenInfo(gp, pairs, chain.id, address, evmAth) : undefined,
      });
    }

    // No source but GoPlus returned token data — build token profile
    if (gp && isKnownToken) {
      return NextResponse.json({
        name: String(gp.token_name || `Token_${address.slice(0, 8)}`),
        code: buildEvmTokenProfile(address, chain.name, gp, pairs),
        compiler: 'GoPlus Security',
        chain: chain.name,
        address,
        verified: false,
        tokenInfo: buildEvmTokenInfo(gp, pairs, chain.id, address, evmAth),
      });
    }

    return NextResponse.json({
      error: `Contract not found or not verified on ${chain.name}. Ensure it is verified on a supported block explorer.`,
    }, { status: 404 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function parseSourceCode(raw: string): string {
  if (raw.startsWith('{{') && raw.endsWith('}}')) {
    try {
      const parsed = JSON.parse(raw.slice(1, -1));
      const sources = parsed.sources || parsed;
      const files = Object.entries(sources) as [string, { content: string }][];
      return files.map(([filename, file]) => `// ─── ${filename} ───\n${file.content}`).join('\n\n');
    } catch { return raw; }
  }
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.sources) {
        const files = Object.entries(parsed.sources) as [string, { content: string }][];
        return files.map(([filename, file]) => `// ─── ${filename} ───\n${file.content}`).join('\n\n');
      }
    } catch { /* Not JSON */ }
  }
  return raw;
}
