import { NextRequest, NextResponse } from 'next/server';
import { CHAINS } from '@/lib/types';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

// Etherscan V2 chain IDs (unified API — one key for all chains)
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  bsc: 56,
  avalanche: 43114,
};

export async function POST(req: NextRequest) {
  // ── Auth gate ──
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'utility');
  if (limited) return limited;

  try {
    const body = await req.json();
    const { address, chainId } = body;

    if (!address || typeof address !== 'string' || !chainId || typeof chainId !== 'string') {
      return NextResponse.json({ error: 'Address and chain are required' }, { status: 400 });
    }

    const chain = CHAINS.find((c) => c.id === chainId);
    if (!chain) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }

    // Validate address format based on chain type
    if (chain.type === 'solana') {
      // Solana: base58 encoded 32-byte pubkey, 32–44 chars, no 0x prefix
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return NextResponse.json({ error: 'Invalid Solana address format' }, { status: 400 });
      }
    } else {
      // EVM: 0x + 40 hex chars
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
      }
    }

    // Solana: multi-strategy fetch with account type detection
    if (chain.type === 'solana') {
      let solCode = '';
      let solName = `Program_${address.slice(0, 8)}`;

      // ─── Strategy 0a: Solana RPC — classify account type ───
      // We fetch account info first to distinguish between:
      //   • SPL token mints (pump.fun, launched tokens, LP tokens)
      //   • Protocol data accounts (Raydium pool, Meteora DLMM, etc.)
      //   • Executable programs (fall through to source strategies)

      // Protocol owner program ID → name/type map
      const PROTOCOL_MAP: Record<string, { name: string; type: string }> = {
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': { name: 'Raydium AMM v4',   type: 'amm_pool' },
        'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': { name: 'Raydium CLMM',     type: 'clmm_pool' },
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc':  { name: 'Orca Whirlpool',   type: 'clmm_pool' },
        '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': { name: 'Orca AMM',          type: 'amm_pool' },
        'LBUZKhRxPF3XUpBCjp4YzTKgLe4rvxjH1AzEHgBQA5':  { name: 'Meteora DLMM',     type: 'dlmm_pool' },
        'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': { name: 'Meteora Dynamic AMM', type: 'amm_pool' },
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4':  { name: 'Jupiter v6',       type: 'aggregator' },
        'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA':  { name: 'pump.fun AMM',     type: 'amm_pool' },
        '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P':  { name: 'pump.fun Bonding', type: 'bonding_curve' },
        'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo':  { name: 'Solend',           type: 'lending' },
        'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68':  { name: 'Marginfi',         type: 'lending' },
        'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD':  { name: 'Marinade',         type: 'liquid_staking' },
        'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S': { name: 'Lifinity',         type: 'amm_pool' },
      };

      // Helper: build a liquidity risk label
      const liqRisk = (usd: number) =>
        usd < 10_000  ? 'CRITICAL — trivially manipulable with small capital' :
        usd < 100_000 ? 'HIGH — vulnerable to flash loan price manipulation' :
        usd < 1_000_000 ? 'MEDIUM — manipulation requires significant capital' :
        'LOW — deep liquidity reduces manipulation risk';

      // Helper: build a pool security profile from DexScreener pair data
      type DexPair = {
        dexId: string; pairAddress: string;
        baseToken: { address: string; name: string; symbol: string };
        quoteToken: { address: string; name: string; symbol: string };
        liquidity?: { usd?: number };
        volume?: { h24?: number };
        priceUsd?: string;
        priceChange?: { m5?: number; h1?: number; h24?: number };
        txns?: { h24?: { buys?: number; sells?: number } };
        pairCreatedAt?: number;
        fdv?: number;
        marketCap?: number;
      };

      const buildPoolProfile = (pair: DexPair, ownerProtocol?: string): string => {
        const liqUsd   = pair.liquidity?.usd ?? 0;
        const vol24h   = pair.volume?.h24 ?? 0;
        const protocol = ownerProtocol || pair.dexId || 'Unknown';
        const ageMs    = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null;
        const ageDays  = ageMs ? Math.floor(ageMs / 86_400_000) : null;
        const ch24     = pair.priceChange?.h24 ?? 0;
        const ch1      = pair.priceChange?.h1  ?? 0;
        const txns     = pair.txns?.h24 || { buys: 0, sells: 0 };
        const buySellRatio = txns.sells && txns.buys
          ? (txns.buys / (txns.buys + txns.sells) * 100).toFixed(1)
          : 'N/A';

        return [
          `// ─── DeFi Pool On-Chain Security Analysis ───`,
          `// Pool: ${pair.pairAddress}`,
          `// Protocol: ${protocol} (dexId: ${pair.dexId})`,
          `// Source: DexScreener + Solana Mainnet RPC`,
          ``,
          `const POOL_ADDRESS  = "${pair.pairAddress}";`,
          `const PROTOCOL      = "${protocol}";`,
          `const BASE_TOKEN    = "${pair.baseToken.address}"; // ${pair.baseToken.name} (${pair.baseToken.symbol})`,
          `const QUOTE_TOKEN   = "${pair.quoteToken.address}"; // ${pair.quoteToken.name} (${pair.quoteToken.symbol})`,
          `const PRICE_USD     = ${pair.priceUsd ?? 'null'};`,
          ``,
          `// ─── Liquidity & Volume ───`,
          `const LIQUIDITY_USD = ${liqUsd.toFixed(2)}; // Risk: ${liqRisk(liqUsd)}`,
          `const VOLUME_24H    = ${vol24h.toFixed(2)};`,
          `const VOL_LIQ_RATIO = ${liqUsd > 0 ? (vol24h / liqUsd).toFixed(2) : 'N/A'}; // ${vol24h / (liqUsd || 1) > 10 ? 'WARNING: High V/L ratio may indicate wash trading' : 'Normal range'}`,
          ``,
          `// ─── Price Action ───`,
          `const PRICE_CHANGE_1H  = ${ch1}%; // ${Math.abs(ch1) > 50 ? 'WARNING: Extreme 1h volatility' : 'Normal'}`,
          `const PRICE_CHANGE_24H = ${ch24}%; // ${ch24 < -50 ? 'CRITICAL: Possible rug pull — price dumped >50% in 24h' : ch24 > 200 ? 'WARNING: Possible pump-and-dump in progress' : 'Normal'}`,
          ``,
          `// ─── Trading Activity ───`,
          `const BUYS_24H        = ${txns.buys ?? 0};`,
          `const SELLS_24H       = ${txns.sells ?? 0};`,
          `const BUY_RATIO_PCT   = ${buySellRatio}; // ${Number(buySellRatio) > 80 ? 'WARNING: Buy-heavy skew typical of coordinated pump' : Number(buySellRatio) < 20 ? 'WARNING: Sell-heavy skew — possible exit event' : 'Normal distribution'}`,
          ageDays !== null ? `const POOL_AGE_DAYS   = ${ageDays}; // ${ageDays < 1 ? 'HIGH: Pool is less than 24h old' : ageDays < 7 ? 'MEDIUM: Pool is less than 1 week old' : 'Established pool'}` : '',
          pair.fdv     ? `const FDV_USD         = ${pair.fdv};` : '',
          pair.marketCap ? `const MARKET_CAP_USD  = ${pair.marketCap};` : '',
          ``,
          `// ─── Protocol Risk Notes ───`,
          `// - Protocol "${protocol}" is a ${PROTOCOL_MAP[pair.dexId] ? PROTOCOL_MAP[pair.dexId].type.replace('_', ' ') : 'DeFi pool'}.`,
          `// - Re-entrancy risk depends on protocol-level audit status.`,
          `// - Flash loan attacks are ${liqUsd < 100_000 ? 'HIGH risk at this liquidity level' : 'possible but costly at this liquidity depth'}.`,
          `// - Audit the underlying token contracts for mint/freeze authority risks.`,
        ].filter(Boolean).join('\n');
      };

      // ─── RPC fetch (classify account) ───
      let rpcInfo: { executable: boolean; owner: string; data: { parsed?: { type: string; info: Record<string, unknown>; program?: string }; program?: string } | null } | null = null;
      try {
        const rpcRes = await fetch('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
            params: [address, { encoding: 'jsonParsed' }],
          }),
        });
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          rpcInfo = rpcData?.result?.value ?? null;
        }
      } catch { /* RPC timeout, fall through */ }

      // ─── Path A: SPL Token Mint ───
      if (rpcInfo && !rpcInfo.executable && rpcInfo.data?.parsed?.type === 'mint') {
        const mint = rpcInfo.data.parsed.info;
        const tokenProgram = rpcInfo.data.parsed.program || rpcInfo.data.program || 'spl-token';
        const extensions: string[] = ((mint.extensions as { extension: string }[] | undefined) || []).map(e => e.extension);
        const metadata = (mint.extensions as { extension: string; state: Record<string, unknown> }[] | undefined)
          ?.find(e => e.extension === 'tokenMetadata')?.state;
        const isPumpFun = address.endsWith('pump');

        const DANGEROUS_EXTENSIONS: Record<string, string> = {
          permanentDelegate:     'CRITICAL: Can transfer tokens from any wallet without consent',
          transferHook:          'HIGH: Calls external program on every transfer (potential rug hook)',
          transferFeeConfig:     'MEDIUM: Applies a fee to every transfer',
          mintCloseAuthority:    'HIGH: Can close the mint account, destroying all token supply',
          nonTransferable:       'LOW: Tokens are soul-bound and cannot be transferred',
          interestBearingConfig: 'LOW: Dynamically adjusts displayed supply via interest accrual',
        };
        const flaggedExts = extensions.filter(e => DANGEROUS_EXTENSIONS[e]);

        // Enrich with DexScreener trading pair data
        let dexLines: string[] = [];
        try {
          const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (dexRes.ok) {
            const dexData = await dexRes.json();
            const pairs: DexPair[] = (dexData.pairs || []).filter(
              (p: DexPair) => p.baseToken?.address === address || p.quoteToken?.address === address
            ).sort((a: DexPair, b: DexPair) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

            if (pairs.length > 0) {
              const totalLiq = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
              dexLines = [
                ``,
                `// ─── Trading Pairs (via DexScreener) ───`,
                `const TOTAL_LIQUIDITY_USD = ${totalLiq.toFixed(2)}; // Risk: ${liqRisk(totalLiq)}`,
                ...pairs.slice(0, 5).map((p, i) =>
                  `const PAIR_${i + 1} = { dex: "${p.dexId}", address: "${p.pairAddress}", liq: ${(p.liquidity?.usd ?? 0).toFixed(0)}, vol24h: ${(p.volume?.h24 ?? 0).toFixed(0)}, ch24: "${p.priceChange?.h24 ?? '?'}%" };`
                ),
              ];
            }
          }
        } catch { /* DexScreener enrichment optional */ }

        solCode = [
          `// ─── SPL Token On-Chain Security Analysis ───`,
          `// Mint: ${address}`,
          `// Token Standard: ${tokenProgram === 'spl-token-2022' ? 'SPL Token-2022 (with extensions)' : 'SPL Token (legacy)'}`,
          `// Source: Solana Mainnet RPC + DexScreener`,
          isPumpFun ? `// Platform: pump.fun bonding curve token` : '',
          ``,
          `const MINT    = "${address}";`,
          `const NAME    = "${(metadata?.name as string) || 'Unknown'}";`,
          `const SYMBOL  = "${(metadata?.symbol as string) || '?'}";`,
          `const DECIMALS = ${mint.decimals};`,
          `const SUPPLY  = ${mint.supply}; // raw (divide by 10^DECIMALS for UI value)`,
          ``,
          `// ─── Authority Settings ───`,
          `const MINT_AUTHORITY   = ${mint.mintAuthority   ? `"${mint.mintAuthority}"` : 'null'}; // ${mint.mintAuthority   ? 'WARNING: Owner can mint unlimited tokens (rug via inflation)' : 'Safe: supply is permanently fixed'}`,
          `const FREEZE_AUTHORITY = ${mint.freezeAuthority ? `"${mint.freezeAuthority}"` : 'null'}; // ${mint.freezeAuthority ? 'WARNING: Owner can freeze any token account' : 'Safe: token accounts cannot be frozen'}`,
          `const UPDATE_AUTHORITY = ${metadata?.updateAuthority ? `"${metadata.updateAuthority}"` : 'null'}; // ${metadata?.updateAuthority ? 'WARNING: Metadata can be changed post-launch' : 'Safe: metadata is immutable'}`,
          ``,
          extensions.length > 0 ? [
            `// ─── Token-2022 Extensions ───`,
            ...extensions.map(e =>
              `const EXT_${e.replace(/([A-Z])/g, '_$1').toUpperCase()} = true; // ${DANGEROUS_EXTENSIONS[e] || 'Informational'}`
            ),
          ].join('\n') : `// No Token-2022 extensions`,
          ...dexLines,
          isPumpFun ? [
            ``,
            `// ─── pump.fun Notes ───`,
            `// Bonding curve program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`,
            `// Graduates to Raydium at ~$69K market cap. Once graduated, bonding curve ends.`,
          ].join('\n') : '',
          flaggedExts.length > 0 ? [
            ``,
            `// ⚠️  DANGEROUS EXTENSIONS DETECTED`,
            ...flaggedExts.map(e => `// ⚠️  ${e}: ${DANGEROUS_EXTENSIONS[e]}`),
          ].join('\n') : '',
        ].filter(Boolean).join('\n');

        return NextResponse.json({
          name: (metadata?.name as string) || solName,
          code: solCode,
          compiler: tokenProgram === 'spl-token-2022' ? 'SPL Token-2022' : 'SPL Token',
          chain: 'Solana',
          address,
          verified: false,
        });
      }

      // ─── Path B: DeFi Pool / Pair (Raydium, Meteora, Orca, Jupiter, pumpswap, etc.) ───
      // Try DexScreener pair lookup on the address directly.
      // This catches any pool/pair address regardless of protocol.
      if (!rpcInfo?.executable) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            const pair: DexPair | null = pairData.pairs?.[0] || pairData.pair || null;
            if (pair?.baseToken && pair?.quoteToken) {
              const ownerProtocol = rpcInfo?.owner ? PROTOCOL_MAP[rpcInfo.owner]?.name : undefined;
              const profile = buildPoolProfile(pair, ownerProtocol);
              return NextResponse.json({
                name: `${pair.baseToken.symbol}/${pair.quoteToken.symbol} (${pair.dexId})`,
                code: profile,
                compiler: 'DexScreener / Solana RPC',
                chain: 'Solana',
                address,
                verified: false,
              });
            }
          }
        } catch { /* DexScreener pair lookup failed */ }
      }

      // ─── Strategy 1: Solscan verified source (requires API key) ───
      try {
        const res = await fetch(`https://pro-api.solscan.io/v2.0/account/program_source?address=${address}`, {
          headers: { 'Accept': 'application/json', 'token': process.env.SOLSCAN_API_KEY || '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data?.source_code) {
            solCode = data.data.source_code;
            solName = data.data.program_name || solName;
          }
        }
      } catch { /* Solscan failed */ }

      // ─── Strategy 2: OtterSec / Ellipsis verified builds registry ───
      if (!solCode) {
        try {
          const res = await fetch(`https://verify.osec.io/status/${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.is_verified && data?.repo_url) {
              const repoUrl = data.repo_url.replace('github.com', 'raw.githubusercontent.com').replace('/tree/', '/');
              const libRes = await fetch(`${repoUrl}/programs/${data.program_name || 'program'}/src/lib.rs`);
              if (libRes.ok) {
                solCode = await libRes.text();
                solName = data.program_name || solName;
              }
            }
          }
        } catch { /* OtterSec failed */ }
      }

      // ─── Strategy 3: Anchor IDL (interface-level fallback) ───
      if (!solCode) {
        try {
          const res = await fetch(`https://anchor.so/api/v1/idl/${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const idl = await res.json();
            if (idl?.instructions || idl?.name) {
              solCode = `// ─── Anchor IDL for ${idl.name || address} ───\n`;
              solCode += `// Full source unavailable. Interface extracted from on-chain IDL.\n\n`;
              solCode += JSON.stringify(idl, null, 2);
              solName = idl.name || solName;
            }
          }
        } catch { /* Anchor IDL failed */ }
      }

      if (solCode) {
        return NextResponse.json({
          name: solName,
          code: solCode,
          compiler: 'Anchor / Native',
          chain: 'Solana',
          address,
          verified: true,
        });
      }

      return NextResponse.json({
        error: 'Program source not found. Verified source code requires OtterSec or Solscan verification. Unverified programs must be pasted manually.',
      }, { status: 404 });
    }

    // EVM chains: try multiple sources
    const numericChainId = CHAIN_IDS[chain.id];
    const apiKey = process.env.ETHERSCAN_API_KEY || '';

    let sourceCode = '';
    let contractName = '';
    let compilerVersion = '';

    // Strategy 1: Etherscan V2 unified API (one key for all EVM chains)
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
      } catch {
        // V2 failed, try chain-specific
      }
    }

    // Strategy 2: Chain-specific Etherscan API (fallback)
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
      } catch {
        // Chain-specific failed
      }
    }

    // Strategy 3: Sourcify (decentralized, no API key needed)
    if (!sourceCode && numericChainId) {
      try {
        const sourcifyUrl = `https://sourcify.dev/server/files/${numericChainId}/${address}`;
        const res = await fetch(sourcifyUrl);
        if (res.ok) {
          const files = await res.json();
          if (Array.isArray(files) && files.length > 0) {
            // Filter to .sol files
            const solFiles = files.filter((f: { name: string }) => f.name?.endsWith('.sol'));
            if (solFiles.length > 0) {
              sourceCode = solFiles
                .map((f: { name: string; content: string }) => `// ─── ${f.name} ───\n${f.content}`)
                .join('\n\n');
              contractName = solFiles[0]?.name?.replace('.sol', '') || '';
            }
          }
        }
      } catch {
        // Sourcify failed
      }
    }

    // No source found across all strategies
    if (!sourceCode) {
      return NextResponse.json({
        error: `Contract not found or not verified on ${chain.name}. Ensure the contract is verified on a supported block explorer.`,
      }, { status: 404 });
    }

    // Parse multi-file contracts
    sourceCode = parseSourceCode(sourceCode);

    return NextResponse.json({
      name: contractName || `Contract_${address.slice(0, 8)}`,
      code: sourceCode,
      compiler: compilerVersion || 'Unknown',
      chain: chain.name,
      address,
      verified: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Handle Etherscan's various source code formats
function parseSourceCode(raw: string): string {
  // Multi-file JSON wrapped in double braces: {{...}}
  if (raw.startsWith('{{') && raw.endsWith('}}')) {
    try {
      const parsed = JSON.parse(raw.slice(1, -1));
      const sources = parsed.sources || parsed;
      const files = Object.entries(sources) as [string, { content: string }][];
      return files
        .map(([filename, file]) => `// ─── ${filename} ───\n${file.content}`)
        .join('\n\n');
    } catch {
      return raw;
    }
  }

  // Single-file JSON with sources key
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.sources) {
        const files = Object.entries(parsed.sources) as [string, { content: string }][];
        return files
          .map(([filename, file]) => `// ─── ${filename} ───\n${file.content}`)
          .join('\n\n');
      }
    } catch {
      // Not JSON, use as-is
    }
  }

  return raw;
}
