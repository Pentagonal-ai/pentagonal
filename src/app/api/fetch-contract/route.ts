import { NextRequest, NextResponse } from 'next/server';
import { CHAINS } from '@/lib/types';

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
  try {
    const body = await req.json();
    const { address, chainId } = body;

    if (!address || typeof address !== 'string' || !chainId || typeof chainId !== 'string') {
      return NextResponse.json({ error: 'Address and chain are required' }, { status: 400 });
    }

    // Validate address format (basic hex check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    const chain = CHAINS.find((c) => c.id === chainId);
    if (!chain) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }

    // Solana: try multiple verification sources
    if (chain.type === 'solana') {
      let solCode = '';
      let solName = `Program_${address.slice(0, 8)}`;

      // Strategy 1: Solscan verified source (public API)
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

      // Strategy 2: OtterSec / Ellipsis verified builds registry
      if (!solCode) {
        try {
          const res = await fetch(`https://verify.osec.io/status/${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.is_verified && data?.repo_url) {
              // Try to fetch the main lib.rs from the verified repo
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

      // Strategy 3: Anchor IDL (at least gives the interface)
      if (!solCode) {
        try {
          const res = await fetch(`https://anchor.so/api/v1/idl/${address}`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const idl = await res.json();
            if (idl?.instructions || idl?.name) {
              // Convert IDL to a readable Rust-like interface
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
        error: 'Program source not found. Solana programs must be verified via OtterSec or Solscan to be fetched automatically. Paste your code manually.',
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
        error: `Contract not found or not verified on ${chain.name}. ${!apiKey ? 'Add ETHERSCAN_API_KEY to .env.local for best results.' : ''}`,
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
