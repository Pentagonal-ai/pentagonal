// Contract ABIs + deploy config for the Qcipher on-chain layer. Addresses are
// filled at deploy (testnet/mainnet) via env; until then they are the zero
// address and the UI runs in local demo mode.

export const QCIPHER = {
  // Base mainnet by default; override via env (84532 = Base Sepolia testnet).
  chainId: Number(process.env.NEXT_PUBLIC_QCIPHER_CHAIN_ID ?? 8453),
  keyRegistry: (process.env.NEXT_PUBLIC_QCIPHER_KEY_REGISTRY ??
    '0x0c52df0cdc3c50ba5b946100e9aa8e259b66cafb') as `0x${string}`,
  messenger: (process.env.NEXT_PUBLIC_QCIPHER_MESSENGER ??
    '0x4cc3970664472845c949e396b9d6ed2d4c37f5aa') as `0x${string}`,
} as const;

export const KEY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bundle', type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'KeyRegistered',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'bundle', type: 'bytes', indexed: false },
    ],
  },
] as const;

export const MESSENGER_ABI = [
  {
    type: 'function',
    name: 'send',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'convoId', type: 'bytes32' },
      { name: 'epoch', type: 'uint64' },
      { name: 'payload', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Message',
    inputs: [
      { name: 'convoId', type: 'bytes32', indexed: true },
      { name: 'epoch', type: 'uint64', indexed: false },
      { name: 'payload', type: 'bytes', indexed: false },
    ],
  },
] as const;
