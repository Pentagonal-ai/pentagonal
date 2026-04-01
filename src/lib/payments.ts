/**
 * Pentagonal — Sovereign Payment Constants
 * Token addresses, pricing, pack definitions, and ERC20 ABI
 */

// ─── Pricing ───
export const SINGLE_CREATE_PRICE = 20;
export const SINGLE_AUDIT_PRICE = 20;
export const EDIT_PRICE = 10;

export type CreditType = 'creation' | 'audit' | 'edit';
export type PackSize = 1 | 5 | 10;

export interface PackDefinition {
  credits: number;
  price: number;       // USD
  perUnit: number;
  savings: number;     // USD saved vs buying individually
  label: string;
}

export const PACKS: Record<string, PackDefinition> = {
  single_create: { credits: 1, price: 20, perUnit: 20, savings: 0, label: 'Single Create' },
  single_audit:  { credits: 1, price: 20, perUnit: 20, savings: 0, label: 'Single Audit' },
  single_edit:   { credits: 1, price: 10, perUnit: 10, savings: 0, label: 'Single Edit' },
  pack_5:        { credits: 5, price: 80, perUnit: 16, savings: 20, label: '5-Pack' },
  pack_10:       { credits: 10, price: 150, perUnit: 15, savings: 50, label: '10-Pack' },
};

// ─── Supported Payment Tokens ───
export type PaymentToken = 'USDC' | 'USDT' | 'SOL' | 'ETH' | 'BNB';

export const STABLECOINS: PaymentToken[] = ['USDC', 'USDT'];
export const NATIVE_TOKENS: PaymentToken[] = ['SOL', 'ETH', 'BNB'];

// ─── Token Contract Addresses (verified mainnet) ───
export const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  // EVM chains
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  polygon: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  bsc: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
  arbitrum: {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  optimism: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  },
  avalanche: {
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  // Solana
  solana: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
};

// ─── Token Decimals ───
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  BNB: 18,
  SOL: 9,
};

// ─── Chain → Viem chain ID mapping ───
export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  avalanche: 43114,
};

// ─── ERC20 Transfer ABI (minimal) ───
export const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

// ─── Treasury addresses ───
export function getTreasuryAddress(chain: string): string {
  if (chain === 'solana') {
    const addr = process.env.NEXT_PUBLIC_TREASURY_SOLANA_ADDRESS || process.env.TREASURY_SOLANA_ADDRESS;
    if (!addr) throw new Error('TREASURY_SOLANA_ADDRESS not configured');
    return addr;
  }
  const addr = process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS;
  if (!addr) throw new Error('TREASURY_WALLET_ADDRESS not configured');
  return addr;
}

// ─── USD amount for a pack ───
export function getPackPrice(packId: string): number {
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Unknown pack: ${packId}`);
  return pack.price;
}

export function getPackCredits(packId: string): number {
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Unknown pack: ${packId}`);
  return pack.credits;
}
