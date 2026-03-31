// Shared chain constants — single source of truth for explorer URLs, chain names, and testnet IDs

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 11155111: 'Sepolia', 137: 'Polygon', 80002: 'Amoy',
  56: 'BSC', 97: 'BSC Testnet', 42161: 'Arbitrum', 421614: 'Arb Sepolia',
  8453: 'Base', 84532: 'Base Sepolia', 10: 'Optimism', 11155420: 'OP Sepolia',
  43114: 'Avalanche', 43113: 'Fuji',
};

export const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io', 11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com', 80002: 'https://amoy.polygonscan.com',
  56: 'https://bscscan.com', 97: 'https://testnet.bscscan.com',
  42161: 'https://arbiscan.io', 421614: 'https://sepolia.arbiscan.io',
  8453: 'https://basescan.org', 84532: 'https://sepolia.basescan.org',
  10: 'https://optimistic.etherscan.io', 11155420: 'https://sepolia-optimism.etherscan.io',
  43114: 'https://snowscan.xyz', 43113: 'https://testnet.snowscan.xyz',
};

export const TESTNET_IDS = new Set([11155111, 80002, 97, 421614, 84532, 11155420, 43113]);

export const TESTNET_FAUCETS: Record<number, Array<{ name: string; url: string }>> = {
  11155111: [
    { name: 'Google Cloud Faucet', url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' },
    { name: 'Alchemy', url: 'https://sepoliafaucet.com/' },
  ],
  97: [{ name: 'BNB Chain Faucet', url: 'https://www.bnbchain.org/en/testnet-faucet' }],
  80002: [{ name: 'Polygon Faucet', url: 'https://faucet.polygon.technology/' }],
  421614: [{ name: 'Arbitrum Faucet', url: 'https://faucet.arbitrum.io/' }],
  84532: [{ name: 'Base Faucet', url: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet' }],
  11155420: [{ name: 'Superchain Faucet', url: 'https://app.optimism.io/faucet' }],
  43113: [{ name: 'Avax Faucet', url: 'https://core.app/tools/testnet-faucet/' }],
};
