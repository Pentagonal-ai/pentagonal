// ─── Supported Chains ───
// Single source of truth for chain metadata exposed to AI models

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

export const CHAINS: ChainInfo[] = [
  { id: 'ethereum', name: 'Ethereum', type: 'evm', icon: 'Ξ', explorerUrl: 'https://etherscan.io', chainId: 1, testnetChainId: 11155111, rpcHint: 'Use Alchemy or Infura for RPC' },
  { id: 'polygon', name: 'Polygon', type: 'evm', icon: '⬡', explorerUrl: 'https://polygonscan.com', chainId: 137, testnetChainId: 80002 },
  { id: 'arbitrum', name: 'Arbitrum', type: 'evm', icon: '◆', explorerUrl: 'https://arbiscan.io', chainId: 42161, testnetChainId: 421614 },
  { id: 'base', name: 'Base', type: 'evm', icon: '◎', explorerUrl: 'https://basescan.org', chainId: 8453, testnetChainId: 84532, rpcHint: 'Low gas fees, good for first deploys' },
  { id: 'optimism', name: 'Optimism', type: 'evm', icon: '⊙', explorerUrl: 'https://optimistic.etherscan.io', chainId: 10, testnetChainId: 11155420 },
  { id: 'bsc', name: 'BSC', type: 'evm', icon: '◈', explorerUrl: 'https://bscscan.com', chainId: 56, testnetChainId: 97 },
  { id: 'avalanche', name: 'Avalanche', type: 'evm', icon: '▲', explorerUrl: 'https://snowscan.xyz', chainId: 43114, testnetChainId: 43113 },
  { id: 'solana', name: 'Solana', type: 'solana', icon: '◐', explorerUrl: 'https://solscan.io', rpcHint: 'Use Helius or Triton for RPC' },
];

export function getChain(id: string): ChainInfo | undefined {
  return CHAINS.find(c => c.id === id);
}

export function getChainType(id: string): 'evm' | 'solana' {
  return getChain(id)?.type ?? 'evm';
}
