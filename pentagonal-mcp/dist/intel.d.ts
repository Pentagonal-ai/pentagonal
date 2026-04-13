export type LookupField = 'price' | 'market' | 'liquidity' | 'holders' | 'security' | 'socials' | 'code' | 'all';
export declare function detectChain(address: string): Promise<string | null>;
export interface TokenIntelligence {
    name?: string;
    symbol?: string;
    address: string;
    chain: string;
    verified: boolean;
    priceUsd?: string;
    priceChange24h?: number;
    marketCap?: number;
    volume24h?: number;
    txns24h?: number;
    buys24h?: number;
    sells24h?: number;
    athMarketCap?: number;
    athMultiplier?: number;
    athLabel?: string;
    liquidity?: number;
    dexName?: string;
    pairCount?: number;
    lpUnlockedPct?: number;
    totalHolders?: number;
    ownerPct?: number;
    isHoneypot?: boolean;
    buyTax?: number;
    sellTax?: number;
    isMintable?: boolean;
    isPausable?: boolean;
    hiddenOwner?: boolean;
    canTakeBack?: boolean;
    selfDestruct?: boolean;
    rugScore?: number;
    insidersDetected?: number;
    website?: string;
    twitter?: string;
    telegram?: string;
    dexUrl?: string;
    holderUrl?: string;
    url?: string;
    code?: string;
    compiler?: string;
}
export interface LookupResult {
    intel: TokenIntelligence;
    report: string;
}
export declare function lookupToken(address: string, chain: string, fields?: LookupField[]): Promise<LookupResult>;
//# sourceMappingURL=intel.d.ts.map