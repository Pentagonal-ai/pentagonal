/**
 * Pentagonal — MCP Intel Formatter
 * Formats a raw fetch-contract API response into a readable MCP report.
 * Used by the /api/mcp route to format lookupToken results.
 */

interface TokenInfo {
  name?: string;
  symbol?: string;
  priceUsd?: string | number;
  priceChange24h?: number;
  volume24h?: number;
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  marketCap?: number;
  athMarketCap?: number;
  athMultiplier?: number;
  athLabel?: string;
  liquidity?: number;
  dexName?: string;
  pairCount?: number;
  totalHolders?: number;
  isHoneypot?: boolean;
  buyTax?: number;
  sellTax?: number;
  isMintable?: boolean;
  isPausable?: boolean;
  hiddenOwner?: boolean;
  canTakeBack?: boolean;
  selfDestruct?: boolean;
  ownerPct?: number;
  lpUnlockedPct?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  url?: string;
  dexUrl?: string;
  holderUrl?: string;
}

interface ContractData {
  name?: string;
  address?: string;
  chain?: string;
  compiler?: string;
  verified?: boolean;
  code?: string;
  tokenInfo?: TokenInfo;
  error?: string;
}

export async function lookupToken(data: ContractData): Promise<{ report: string }> {
  if (data.error) {
    return { report: `❌ ${data.error}` };
  }

  const lines: string[] = [];
  const t = data.tokenInfo;

  lines.push(`## ${data.name || 'Unknown Contract'} — ${data.chain || 'Unknown Chain'}`);
  lines.push(`**Address:** \`${data.address}\``);
  if (data.verified) lines.push(`**Verification:** ✅ Source verified (${data.compiler})`);
  else lines.push(`**Verification:** ❌ Source not verified`);

  if (t) {
    if (t.name && t.symbol) {
      lines.push(`\n### 🪙 Token: ${t.name} (${t.symbol})`);
    }

    // Market
    if (t.priceUsd !== undefined) {
      lines.push(`\n### 💰 Market`);
      lines.push(`- **Price:** $${Number(t.priceUsd).toFixed(8)}`);
      if (t.priceChange24h !== undefined) lines.push(`- **24h Change:** ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h?.toFixed(2)}%`);
      if (t.marketCap) lines.push(`- **Market Cap:** $${formatNumber(t.marketCap)}`);
      if (t.athMarketCap && t.athMultiplier) {
        lines.push(`- **ATH Market Cap:** $${formatNumber(t.athMarketCap)} (${t.athLabel || 'ATH'}) — ${t.athMultiplier.toFixed(2)}x from current`);
      }
      if (t.volume24h) lines.push(`- **24h Volume:** $${formatNumber(t.volume24h)}`);
      if (t.txns24h) lines.push(`- **24h Txns:** ${t.txns24h.toLocaleString()} (${t.buys24h ?? 0} buys / ${t.sells24h ?? 0} sells)`);
    }

    // Liquidity
    if (t.liquidity !== undefined) {
      lines.push(`\n### 💧 Liquidity`);
      lines.push(`- **Total Liquidity:** $${formatNumber(t.liquidity)}`);
      if (t.dexName) lines.push(`- **Primary DEX:** ${t.dexName}`);
      if (t.pairCount) lines.push(`- **Pairs:** ${t.pairCount}`);
      if (t.lpUnlockedPct !== undefined) {
        const locked = 100 - t.lpUnlockedPct;
        lines.push(`- **LP Lock:** ${locked.toFixed(1)}% locked / ${t.lpUnlockedPct.toFixed(1)}% unlocked`);
      }
    }

    // Holders
    if (t.totalHolders !== undefined) {
      lines.push(`\n### 👥 Holders`);
      lines.push(`- **Total Holders:** ${t.totalHolders.toLocaleString()}`);
      if (t.ownerPct !== undefined) lines.push(`- **Owner Supply %:** ${t.ownerPct.toFixed(2)}%`);
    }

    // Security
    lines.push(`\n### 🔒 Security`);
    lines.push(`- **Honeypot:** ${t.isHoneypot ? '🚨 YES' : '✅ No'}`);
    if (t.buyTax !== undefined) lines.push(`- **Buy Tax:** ${t.buyTax}%`);
    if (t.sellTax !== undefined) lines.push(`- **Sell Tax:** ${t.sellTax}%`);
    lines.push(`- **Mintable:** ${t.isMintable ? '⚠️ Yes' : '✅ No'}`);
    lines.push(`- **Pausable:** ${t.isPausable ? '⚠️ Yes' : '✅ No'}`);
    lines.push(`- **Hidden Owner:** ${t.hiddenOwner ? '🚨 Yes' : '✅ No'}`);
    lines.push(`- **Can Take Back:** ${t.canTakeBack ? '🚨 Yes' : '✅ No'}`);
    lines.push(`- **Self Destruct:** ${t.selfDestruct ? '🚨 Yes' : '✅ No'}`);

    // Socials
    const hasLinks = t.website || t.twitter || t.telegram || t.dexUrl;
    if (hasLinks) {
      lines.push(`\n### 🔗 Links`);
      if (t.dexUrl) lines.push(`- **DEX:** ${t.dexUrl}`);
      if (t.holderUrl) lines.push(`- **Holders:** ${t.holderUrl}`);
      if (t.website) lines.push(`- **Website:** ${t.website}`);
      if (t.twitter) lines.push(`- **Twitter:** ${t.twitter}`);
      if (t.telegram) lines.push(`- **Telegram:** ${t.telegram}`);
    }
  }

  // Source code
  if (data.code) {
    lines.push(`\n### 📄 Source Code`);
    lines.push(`\`\`\`solidity\n${data.code.slice(0, 3000)}${data.code.length > 3000 ? '\n// ... (truncated)' : ''}\n\`\`\``);
  }

  return { report: lines.join('\n') };
}

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}
