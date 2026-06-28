import 'server-only';
import { createPublicClient, http, getAddress, type Address } from 'viem';
import { mainnet } from 'viem/chains';

/**
 * Pentagonal — Token Gate
 * Holders of >= 0.25% of the gating token get a daily free credit.
 *
 * Token: ERC-20 on Ethereum mainnet.
 * Threshold: 0.25% of total supply = 25 basis points (of 10,000).
 * Supply + balance are read live so the check is decimals-agnostic and
 * survives any future mint/burn. Fails CLOSED on any RPC error.
 */

const TOKEN_ADDRESS = '0x92B89BD08D7625407de0F9E746c6546d3b52d64f' as Address;
const THRESHOLD_BPS = BigInt(25); // 0.25% = 25 / 10_000
const BPS_DENOM = BigInt(10_000);
const ZERO = BigInt(0);

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// http() with no URL uses viem's default public RPC (same as verify-payment).
// Set ETHEREUM_RPC_URL for a dedicated/reliable endpoint in production.
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || undefined),
});

export type HolderCheck = {
  eligible: boolean;
  balance: bigint;
  supply: bigint;
  threshold: bigint;
};

/** True iff `wallet` holds >= 0.25% of the gating token's current supply. */
export async function checkTokenHolder(wallet: string): Promise<HolderCheck> {
  const fail: HolderCheck = { eligible: false, balance: ZERO, supply: ZERO, threshold: ZERO };
  // Only EVM addresses can hold an Ethereum ERC-20.
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return fail;

  try {
    const account = getAddress(wallet);
    const [balance, supply] = await client.multicall({
      contracts: [
        { address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [account] },
        { address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: 'totalSupply' },
      ],
      allowFailure: false,
    });
    const threshold = (supply * THRESHOLD_BPS) / BPS_DENOM;
    const eligible = balance > ZERO && balance >= threshold;
    return { eligible, balance, supply, threshold };
  } catch {
    return fail;
  }
}
