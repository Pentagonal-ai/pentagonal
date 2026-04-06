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

      // ─── Strategy 0: Solana RPC account type detection ───
      // Before trying program source, check if the address is a token mint.
      // Token mints (like pump.fun tokens) have no deployable source — we
      // generate a rich on-chain security analysis instead.
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
          const info = rpcData?.result?.value;
          if (info && !info.executable && info.data?.parsed?.type === 'mint') {
            // It's an SPL token mint — build a security profile from on-chain data
            const mint = info.data.parsed.info;
            const extensions: string[] = (mint.extensions || []).map((e: { extension: string }) => e.extension);
            const metadata = info.data.parsed.info.extensions?.find(
              (e: { extension: string }) => e.extension === 'tokenMetadata'
            )?.state;
            const isPumpFun = address.endsWith('pump');

            // Flag dangerous Token-2022 extensions
            const DANGEROUS_EXTENSIONS: Record<string, string> = {
              permanentDelegate:     'CRITICAL: Can transfer tokens from any wallet without consent',
              transferHook:          'HIGH: Calls external program on every transfer (potential rug hook)',
              transferFeeConfig:     'MEDIUM: Applies a fee to every transfer',
              mintCloseAuthority:    'HIGH: Can close the mint account, destroying all token supply',
              nonTransferable:       'LOW: Tokens are soul-bound and cannot be transferred',
              interestBearingConfig: 'LOW: Dynamically adjusts displayed supply via interest accrual',
            };
            const flaggedExts = extensions.filter(e => DANGEROUS_EXTENSIONS[e]);

            solCode = [
              `// ─── SPL Token On-Chain Security Analysis ───`,
              `// Mint: ${address}`,
              `// Token Standard: ${info.data.program === 'spl-token-2022' ? 'SPL Token-2022' : 'SPL Token (legacy)'}`,
              `// Source: Solana Mainnet RPC (real-time)`,
              `// Name: ${metadata?.name || 'Unknown'} (${metadata?.symbol || '?'})`,
              isPumpFun ? `// Platform: pump.fun bonding curve token` : '',
              ``,
              `const MINT = "${address}";`,
              `const NAME = "${metadata?.name || 'Unknown'}";`,
              `const SYMBOL = "${metadata?.symbol || '?'}";`,
              `const DECIMALS = ${mint.decimals};`,
              `const SUPPLY = ${mint.supply}; // raw units (divide by 10^DECIMALS for UI)`,
              ``,
              `// ─── Authority Settings ───`,
              `const MINT_AUTHORITY   = ${mint.mintAuthority   ? `"${mint.mintAuthority}"` : 'null'}; // ${mint.mintAuthority   ? 'WARNING: Owner can mint unlimited tokens (inflation/rug risk)' : 'Safe: supply is permanently fixed'}`,
              `const FREEZE_AUTHORITY = ${mint.freezeAuthority ? `"${mint.freezeAuthority}"` : 'null'}; // ${mint.freezeAuthority ? 'WARNING: Owner can freeze any token account' : 'Safe: token accounts cannot be frozen'}`,
              `const UPDATE_AUTHORITY = ${metadata?.updateAuthority ? `"${metadata.updateAuthority}"` : 'null'}; // ${metadata?.updateAuthority ? 'WARNING: Metadata can be changed by owner' : 'Safe: metadata is immutable'}`,
              ``,
              `// ─── Token-2022 Extensions ───`,
              extensions.length > 0
                ? extensions.map(e =>
                    `const EXT_${e.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')} = true; // ${DANGEROUS_EXTENSIONS[e] || 'Informational'}`
                  ).join('\n')
                : `// No extensions — standard SPL token behaviour`,
              ``,
              isPumpFun ? [
                `// ─── pump.fun Bonding Curve Notes ───`,
                `// Tokens with the 'pump' suffix were launched via pump.fun.`,
                `// Liquidity is managed by the pump.fun bonding curve program`,
                `// (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P).`,
                `// When market cap hits $69K USD the liquidity graduates to Raydium.`,
                `// Audit should assess: authority risk, extension risk, and rugpull vectors.`,
              ].join('\n') : '',
              flaggedExts.length > 0 ? [
                ``,
                `// ─── FLAGGED DANGEROUS EXTENSIONS ───`,
                ...flaggedExts.map(e => `// ⚠️  ${e}: ${DANGEROUS_EXTENSIONS[e]}`),
              ].join('\n') : '',
            ].filter(Boolean).join('\n');

            solName = metadata?.name || solName;

            return NextResponse.json({
              name: solName,
              code: solCode,
              compiler: 'Solana RPC / SPL Token-2022',
              chain: 'Solana',
              address,
              verified: false,
            });
          }
        }
      } catch { /* RPC failed, fall through to program source strategies */ }

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
