// Read-only token scan. Calls Pentagonal's free, no-auth endpoints:
//   POST /api/detect-chain { address }        -> { chain, chainId, ... }
//   POST /api/token-info    { address, chainId } -> market snapshot
// The bot SCANS (market data) but never RUNS audits/generation — those link to the Forge.

const BASE = (process.env.PENTAGONAL_BASE_URL || "https://www.pentagonal.ai").replace(/\/+$/, "");

const EVM_RE = /0x[a-fA-F0-9]{40}/;
// Base58, Solana address length. Checked only after EVM fails.
const SOL_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

/** Pull the first contract address out of arbitrary text, EVM first. */
export function findAddress(text: string): string | null {
  const evm = text.match(EVM_RE);
  if (evm) return evm[0];
  const sol = text.match(SOL_RE);
  if (sol) return sol[0];
  return null;
}

type TokenInfo = {
  found?: boolean;
  error?: string;
  message?: string;
  name?: string;
  symbol?: string;
  priceUsd?: string | null;
  priceChange24h?: number | null;
  volume24h?: number | null;
  txns24h?: number | null;
  buys24h?: number | null;
  sells24h?: number | null;
  liquidity?: number | null;
  marketCap?: number | null;
  pairCount?: number | null;
  dexName?: string | null;
  url?: string | null;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return (await res.json()) as T;
}

function usd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "n/a";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function price(p: string | null | undefined): string {
  if (p == null) return "n/a";
  const n = Number(p);
  if (!isFinite(n)) return "n/a";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toPrecision(3)}`;
  return `$${n.toFixed(4)}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

const FORGE = `${BASE}/forge`;
const FOOTER =
  `\n⚠️ This is a market snapshot, not a security audit.\n` +
  `Run the full 8-agent audit on this contract in the Forge: ${FORGE}`;

/** Scan a token by address and return a Telegram-ready plain-text summary. */
export async function scanToken(addressRaw: string): Promise<string> {
  const address = addressRaw.trim();
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);

  try {
    let chain = "solana";
    if (isEvm) {
      const dc = await post<{ chain?: string | null }>("/api/detect-chain", { address });
      if (!dc?.chain) {
        return (
          `I couldn't find that contract on any supported EVM chain.\n\n` +
          `If it's a Solana token, send the Solana address. Or run a full security audit in the Forge: ${FORGE}`
        );
      }
      chain = dc.chain;
    }

    const t = await post<TokenInfo>("/api/token-info", { address, chainId: chain });

    if (t?.error) {
      return `Scan failed (${t.error}). Try again in a moment, or open it in the Forge: ${FORGE}`;
    }
    if (!t?.found) {
      return (
        `No trading pairs found for this address on ${chain} — it may be a utility or infrastructure contract, not a tradeable token.\n\n` +
        `For a security audit, run it in the Forge: ${FORGE}`
      );
    }

    const lines = [
      `🔎 ${t.name ?? "Unknown"} (${t.symbol ?? "???"}) — ${chain}`,
      ``,
      `Price: ${price(t.priceUsd)}  (24h ${pct(t.priceChange24h)})`,
      `Liquidity: ${usd(t.liquidity)}`,
      `Market cap: ${usd(t.marketCap)}`,
      `24h volume: ${usd(t.volume24h)}`,
      `24h trades: ${t.txns24h ?? 0}  (${t.buys24h ?? 0} buys / ${t.sells24h ?? 0} sells)`,
      `DEX: ${t.dexName ?? "Unknown"}  •  pairs: ${t.pairCount ?? 1}`,
    ];
    if (t.url) lines.push(``, `Chart: ${t.url}`);
    return lines.join("\n") + "\n" + FOOTER;
  } catch (err) {
    console.error("scanToken error:", err);
    return `Couldn't reach the scanner right now. Try again shortly, or open the contract in the Forge: ${FORGE}`;
  }
}
