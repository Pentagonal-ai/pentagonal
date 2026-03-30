#!/usr/bin/env bash
# pentagonal-faucet.sh — Get testnet faucet links for supported chains
set -euo pipefail

CHAIN="${1:-}"

declare -A FAUCETS=(
  [sepolia]="Sepolia (Ethereum):
    - Google Cloud Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
    - Alchemy Faucet: https://sepoliafaucet.com/"
  [amoy]="Amoy (Polygon):
    - Polygon Faucet: https://faucet.polygon.technology/"
  [bsc-testnet]="BSC Testnet:
    - BNB Chain Faucet: https://www.bnbchain.org/en/testnet-faucet"
  [arb-sepolia]="Arbitrum Sepolia:
    - Arbitrum Faucet: https://faucet.arbitrum.io/"
  [base-sepolia]="Base Sepolia:
    - Coinbase Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
  [op-sepolia]="OP Sepolia:
    - Superchain Faucet: https://app.optimism.io/faucet"
  [fuji]="Fuji (Avalanche):
    - Avax Faucet: https://core.app/tools/testnet-faucet/"
  [solana-devnet]="Solana Devnet:
    - Built-in: Use the Airdrop button in Solana Playground
    - CLI: solana airdrop 2 --url devnet
    - Web: https://solfaucet.com"
)

if [[ -z "$CHAIN" ]]; then
  echo "🚰 Available Testnet Faucets"
  echo "═══════════════════════════"
  echo ""
  for key in "${!FAUCETS[@]}"; do
    echo "${FAUCETS[$key]}"
    echo ""
  done
  echo "Usage: pentagonal-faucet.sh <chain>"
  echo "Chains: sepolia, amoy, bsc-testnet, arb-sepolia, base-sepolia, op-sepolia, fuji, solana-devnet"
else
  INFO="${FAUCETS[$CHAIN]:-}"
  if [[ -z "$INFO" ]]; then
    echo "❌ Unknown chain: $CHAIN"
    echo "Available: sepolia, amoy, bsc-testnet, arb-sepolia, base-sepolia, op-sepolia, fuji, solana-devnet"
    exit 1
  fi
  echo "🚰 $INFO"
fi
