export interface ChainInfo {
    id: string;
    name: string;
    type: 'evm' | 'solana';
    icon: string;
    explorerUrl: string;
    chainId?: number;
    testnetChainId?: number;
    rpcHint?: string;
}
export declare const CHAINS: ChainInfo[];
export declare function getChain(id: string): ChainInfo | undefined;
export declare function getChainType(id: string): 'evm' | 'solana';
//# sourceMappingURL=chains.d.ts.map