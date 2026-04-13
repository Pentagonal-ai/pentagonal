// ─── Pentagonal Token Intelligence ───
// Calls the Pentagonal API to fetch enriched token data:
// price, MC, ATH, volume, liquidity, holders, security flags, socials, source code.
// ─── Chain Auto-Detection ───
// Uses DexScreener search to identify which chain a contract is on.
const DEXSCREENER_CHAIN_MAP = {
    ethereum: 'ethereum',
    bsc: 'bsc',
    polygon: 'polygon',
    base: 'base',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    avalanche: 'avalanche',
    solana: 'solana',
};
export async function detectChain(address) {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { headers: { Accept: 'application/json' } });
        if (!res.ok)
            return null;
        const data = await res.json();
        const pairs = data.pairs;
        if (!Array.isArray(pairs) || pairs.length === 0)
            return null;
        const rawChain = pairs[0].chainId?.toLowerCase();
        if (!rawChain)
            return null;
        return DEXSCREENER_CHAIN_MAP[rawChain] || rawChain;
    }
    catch {
        return null;
    }
}
function getApiBase() {
    return process.env.PENTAGONAL_API_URL?.replace(/\/$/, '') || 'https://pentagonal.ai';
}
// Auth priority:
// 1. PENTAGONAL_MCP_KEY  → admin bypass, unlimited
// 2. PENTAGONAL_API_KEY  → per-user key, credits deducted
// 3. No key              → public access, IP rate limited (1 req/min)
function getAuthHeaders() {
    const adminKey = process.env.PENTAGONAL_MCP_KEY;
    if (adminKey)
        return { 'x-pentagonal-key': adminKey };
    const userKey = process.env.PENTAGONAL_API_KEY;
    if (userKey)
        return { 'x-pentagonal-api-key': userKey };
    return {};
}
function fmt(n, prefix = '', suffix = '') {
    if (n == null)
        return 'N/A';
    if (Math.abs(n) >= 1e9)
        return prefix + (n / 1e9).toFixed(2) + 'B' + suffix;
    if (Math.abs(n) >= 1e6)
        return prefix + (n / 1e6).toFixed(2) + 'M' + suffix;
    if (Math.abs(n) >= 1e3)
        return prefix + (n / 1e3).toFixed(1) + 'K' + suffix;
    return prefix + n.toFixed(2) + suffix;
}
function fmtPrice(p) {
    if (!p)
        return 'N/A';
    const n = parseFloat(p);
    if (isNaN(n))
        return p;
    if (n < 0.000001)
        return '$' + n.toExponential(4);
    if (n < 0.01)
        return '$' + n.toFixed(8);
    if (n < 1)
        return '$' + n.toFixed(6);
    return '$' + n.toFixed(4);
}
function flag(v, label) {
    if (v == null)
        return `${label}: N/A`;
    return v ? `${label}: ⚠️ YES` : `${label}: ✅ No`;
}
function buildReport(intel, fields) {
    const all = fields.includes('all');
    const sections = [];
    // ── Header ──
    const tokenId = intel.symbol
        ? `${intel.name} (${intel.symbol})`
        : intel.name || intel.address.slice(0, 12) + '...';
    sections.push(`📊 TOKEN INTELLIGENCE: ${tokenId}`);
    sections.push(`Chain: ${intel.chain} | CA: ${intel.address}`);
    if (intel.dexUrl)
        sections.push(`DexScreener: ${intel.dexUrl}`);
    sections.push('');
    // ── Market Data ──
    if (all || fields.includes('price') || fields.includes('market')) {
        const change = intel.priceChange24h != null
            ? (intel.priceChange24h >= 0 ? `↑${intel.priceChange24h.toFixed(1)}%` : `↓${Math.abs(intel.priceChange24h).toFixed(1)}%`)
            : 'N/A';
        sections.push('── Market Data ──');
        sections.push(`Price: ${fmtPrice(intel.priceUsd)} (${change} 24h)`);
        sections.push(`Market Cap: ${fmt(intel.marketCap, '$')}`);
        if (intel.athMarketCap) {
            sections.push(`ATH Market Cap: ${fmt(intel.athMarketCap, '$')} (${intel.athLabel || ''})`);
        }
        sections.push(`24h Volume: ${fmt(intel.volume24h, '$')}`);
        if (intel.txns24h != null) {
            sections.push(`24h Txns: ${intel.txns24h.toLocaleString()} (${intel.buys24h ?? 'N/A'} buys / ${intel.sells24h ?? 'N/A'} sells)`);
        }
        sections.push('');
    }
    // ── Liquidity ──
    if (all || fields.includes('liquidity')) {
        sections.push('── Liquidity & Pools ──');
        sections.push(`Total Liquidity: ${fmt(intel.liquidity, '$')}`);
        sections.push(`Top DEX: ${intel.dexName || 'N/A'}`);
        sections.push(`Pools: ${intel.pairCount ?? 'N/A'}`);
        sections.push(`LP Unlocked: ${intel.lpUnlockedPct != null ? intel.lpUnlockedPct.toFixed(1) + '%' : 'N/A'}`);
        if (intel.holderUrl)
            sections.push(`Holder Explorer: ${intel.holderUrl}`);
        sections.push('');
    }
    // ── Holders ──
    if (all || fields.includes('holders')) {
        sections.push('── Holders ──');
        sections.push(`Total: ${intel.totalHolders?.toLocaleString() ?? 'N/A'}`);
        sections.push(`Owner Supply: ${intel.ownerPct != null ? intel.ownerPct.toFixed(2) + '%' : 'N/A'}`);
        if (intel.insidersDetected != null) {
            sections.push(`Insider Networks (Rugcheck): ${intel.insidersDetected}`);
        }
        if (intel.rugScore != null) {
            sections.push(`Rugcheck Score: ${intel.rugScore}/100`);
        }
        sections.push('');
    }
    // ── Security ──
    if (all || fields.includes('security')) {
        sections.push('── Security Flags ──');
        sections.push(flag(intel.isHoneypot, 'Honeypot'));
        sections.push(`Buy Tax: ${intel.buyTax != null ? intel.buyTax.toFixed(1) + '%' : 'N/A'} | Sell Tax: ${intel.sellTax != null ? intel.sellTax.toFixed(1) + '%' : 'N/A'}`);
        sections.push(flag(intel.isMintable, 'Mintable'));
        sections.push(flag(intel.isPausable, 'Pausable'));
        sections.push(flag(intel.hiddenOwner, 'Hidden Owner'));
        sections.push(flag(intel.canTakeBack, 'Can Take Back Ownership'));
        sections.push(flag(intel.selfDestruct, 'Self Destruct'));
        sections.push('');
    }
    // ── Socials ──
    if (all || fields.includes('socials')) {
        const hasSocials = intel.website || intel.twitter || intel.telegram;
        if (hasSocials) {
            sections.push('── Socials ──');
            if (intel.website)
                sections.push(`Website: ${intel.website}`);
            if (intel.twitter)
                sections.push(`Twitter/X: ${intel.twitter}`);
            if (intel.telegram)
                sections.push(`Telegram: ${intel.telegram}`);
            sections.push('');
        }
    }
    // ── Source Code ──
    if (all || fields.includes('code')) {
        sections.push('── Source Code ──');
        if (intel.verified && intel.code) {
            sections.push(`Status: Verified ✅`);
            sections.push(`Compiler: ${intel.compiler || 'Unknown'}`);
            sections.push('');
            sections.push(intel.code);
        }
        else {
            sections.push(`Status: Not verified / not available`);
        }
    }
    return sections.join('\n');
}
export async function lookupToken(address, chain, fields = ['all']) {
    const apiBase = getApiBase();
    const authHeaders = getAuthHeaders();
    const res = await fetch(`${apiBase}/api/fetch-contract`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
        },
        body: JSON.stringify({ address, chainId: chain }),
    });
    if (!res.ok) {
        let errMsg = `Pentagonal API returned ${res.status}`;
        try {
            const errBody = await res.json();
            if (errBody.error)
                errMsg = errBody.error;
        }
        catch { /* ignore */ }
        throw new Error(errMsg);
    }
    const data = await res.json();
    if (data.error) {
        throw new Error(data.error);
    }
    // Build the intelligence object from the API response
    const tokenInfo = data.tokenInfo ?? {};
    const intel = {
        name: data.name || tokenInfo.name,
        symbol: tokenInfo.symbol,
        address,
        chain: data.chain || chain,
        verified: data.verified ?? false,
        // Market
        priceUsd: tokenInfo.priceUsd,
        priceChange24h: tokenInfo.priceChange24h,
        marketCap: tokenInfo.marketCap,
        volume24h: tokenInfo.volume24h,
        txns24h: tokenInfo.txns24h,
        buys24h: tokenInfo.buys24h,
        sells24h: tokenInfo.sells24h,
        // ATH
        athMarketCap: tokenInfo.athMarketCap,
        athMultiplier: tokenInfo.athMultiplier,
        athLabel: tokenInfo.athLabel,
        // Liquidity
        liquidity: tokenInfo.liquidity,
        dexName: tokenInfo.dexName,
        pairCount: tokenInfo.pairCount,
        lpUnlockedPct: tokenInfo.lpUnlockedPct,
        // Holders
        totalHolders: tokenInfo.totalHolders,
        ownerPct: tokenInfo.ownerPct,
        // Security (EVM)
        isHoneypot: tokenInfo.isHoneypot,
        buyTax: tokenInfo.buyTax,
        sellTax: tokenInfo.sellTax,
        isMintable: tokenInfo.isMintable,
        isPausable: tokenInfo.isPausable,
        hiddenOwner: tokenInfo.hiddenOwner,
        canTakeBack: tokenInfo.canTakeBack,
        selfDestruct: tokenInfo.selfDestruct,
        // Security (Solana)
        rugScore: tokenInfo.rugScore,
        insidersDetected: tokenInfo.insidersDetected,
        // Socials
        website: tokenInfo.website,
        twitter: tokenInfo.twitter,
        telegram: tokenInfo.telegram,
        // Links
        dexUrl: tokenInfo.dexUrl,
        holderUrl: tokenInfo.holderUrl,
        url: tokenInfo.url,
        // Source code — only include if requested or 'all'
        code: (fields.includes('all') || fields.includes('code')) ? data.code : undefined,
        compiler: data.compiler,
    };
    const report = buildReport(intel, fields);
    return { intel, report };
}
//# sourceMappingURL=intel.js.map