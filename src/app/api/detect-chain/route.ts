// ─── /api/detect-chain ───────────────────────────────────
// Auto-detects which EVM chain a contract address lives on by
// calling eth_getCode in parallel on free public RPCs for every
// supported chain. A non-empty bytecode response means the contract
// exists on that chain.
//
// Why not Etherscan: V1 chain-specific endpoints are deprecated, and
// V2's free tier doesn't cover BSC / Polygon / Base. eth_getCode is
// universal and requires no API key.
//
// Launchpad detection is best-effort: if the BSC RPC reports bytecode
// at the address, we try a single eth_call against the Four.meme
// manager's implementation to confirm. A non-zero return means the
// token is registered with the launchpad.

import { NextRequest, NextResponse } from 'next/server';
import { LAUNCHPADS, type Launchpad } from '@/lib/launchpads';

type ChainSpec = { id: string; chainId: number; rpc: string };

const EVM_CHAINS: ChainSpec[] = [
  { id: 'ethereum',  chainId: 1,     rpc: 'https://ethereum-rpc.publicnode.com' },
  { id: 'polygon',   chainId: 137,   rpc: 'https://polygon-rpc.com' },
  { id: 'arbitrum',  chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc' },
  { id: 'base',      chainId: 8453,  rpc: 'https://mainnet.base.org' },
  { id: 'optimism',  chainId: 10,    rpc: 'https://mainnet.optimism.io' },
  { id: 'bsc',       chainId: 56,    rpc: 'https://bsc-dataseed.binance.org' },
  { id: 'avalanche', chainId: 43114, rpc: 'https://api.avax.network/ext/bc/C/rpc' },
];

async function rpc<T = string>(rpcUrl: string, method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      // 4-second per-RPC budget; we run 7 in parallel anyway
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.result as T) ?? null;
  } catch {
    return null;
  }
}

async function hasContract(address: string, rpcUrl: string): Promise<boolean> {
  const code = await rpc<string>(rpcUrl, 'eth_getCode', [address, 'latest']);
  // eth_getCode returns "0x" for EOAs / non-contracts; non-empty for contracts
  return typeof code === 'string' && code.length > 2;
}

// Pad a 20-byte address to 32 bytes for ABI-encoded calldata.
function pad32(hex: string): string {
  const clean = hex.replace(/^0x/, '').toLowerCase();
  return clean.padStart(64, '0');
}

// Best-effort Four.meme verification. Tries a few likely view-function
// selectors against the Token Manager. If any returns non-zero data
// for the queried token, we consider it Four.meme-registered.
async function verifyFourMeme(token: string, rpcUrl: string, factory: string): Promise<boolean> {
  // Common selector candidates for "is this token from us?" lookups.
  // We try them in order; first non-zero response wins.
  // _tokenInfos(address)              0xa1d63a47   (typical TokenInfo getter)
  // tokenInfos(address)               0xa83627de
  // _tokenInfo(address)               0xb6dad59c
  // tokenInfo(address)                0xa9059cbb (collision risk; safer to skip)
  // isCreator(address)                0x4b2a9c66
  const candidates = ['0xa1d63a47', '0xa83627de', '0xb6dad59c'];
  const padded = pad32(token);
  for (const sel of candidates) {
    const data = await rpc<string>(rpcUrl, 'eth_call', [
      { to: factory, data: sel + padded },
      'latest',
    ]);
    if (typeof data === 'string' && data.length > 2 && !/^0x0+$/.test(data)) {
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const address = (body.address || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  // Check eth_getCode in parallel on every chain
  const hits = await Promise.all(
    EVM_CHAINS.map(async (c) => ({
      ...c,
      hasCode: await hasContract(address, c.rpc),
    })),
  );

  const present = hits.filter(h => h.hasCode);
  if (present.length === 0) {
    return NextResponse.json({ chain: null, launchpad: null, source: 'no-bytecode' });
  }

  // 2. Launchpad probe — if BSC is in the present set, try Four.meme verification
  let launchpad: Launchpad | null = null;
  const bsc = present.find(h => h.id === 'bsc');
  if (bsc) {
    const fourMeme = LAUNCHPADS.find(l => l.id === 'four-meme');
    if (fourMeme) {
      const matched = await verifyFourMeme(address, bsc.rpc, fourMeme.factoryAddress);
      if (matched) launchpad = fourMeme;
    }
  }

  // Choose the chain: launchpad-matched chain wins; otherwise first present.
  const chosen = launchpad
    ? present.find(h => h.id === launchpad!.id) ?? present[0]
    : present[0];

  return NextResponse.json({
    chain: chosen.id,
    chainId: chosen.chainId,
    launchpad,
    source: launchpad ? 'launchpad-match' : 'bytecode-present',
    presentOn: present.map(p => p.id),
  });
}
