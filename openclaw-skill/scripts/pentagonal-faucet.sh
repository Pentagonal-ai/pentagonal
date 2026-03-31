#!/usr/bin/env bash
# pentagonal-faucet.sh — Get testnet faucet links for supported chains
set -euo pipefail

CHAIN="${1:-}"

# bash 3.2 compatible — no declare -A
get_faucet_info() {
  case "$1" in
    sepolia)
      echo "Sepolia (Ethereum):
    - Google Cloud Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
    - Alchemy Faucet: https://sepoliafaucet.com/" ;;
    amoy)
      echo "Amoy (Polygon):
    - Polygon Faucet: https://faucet.polygon.technology/" ;;
    bsc-testnet)
      echo "BSC Testnet:
    - BNB Chain Faucet: https://www.bnbchain.org/en/testnet-faucet" ;;
    arb-sepolia)
      echo "Arbitrum Sepolia:
    - Arbitrum Faucet: https://faucet.arbitrum.io/" ;;
    base-sepolia)
      echo "Base Sepolia:
    - Coinbase Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet" ;;
    op-sepolia)
      echo "OP Sepolia:
    - Superchain Faucet: https://app.optimism.io/faucet" ;;
    fuji)
      echo "Fuji (Avalanche):
    - Avax Faucet: https://core.app/tools/testnet-faucet/" ;;
    solana-devnet)
      echo "Solana Devnet:
    - Built-in: Use the Airdrop button in Solana Playground
    - CLI: solana airdrop 2 --url devnet
    - Web: https://solfaucet.com" ;;
    *)
      return 1 ;;
  esac
}

ALL_CHAINS="sepolia amoy bsc-testnet arb-sepolia base-sepolia op-sepolia fuji solana-devnet"

if [[ -z "$CHAIN" ]]; then
  echo "🚰 Available Testnet Faucets"
  echo "═══════════════════════════"
  echo ""
  for key in $ALL_CHAINS; do
    get_faucet_info "$key"
    echo ""
  done
  echo "Usage: pentagonal-faucet.sh <chain>"
  echo "Chains: $ALL_CHAINS"
else
  INFO=$(get_faucet_info "$CHAIN" 2>/dev/null) || {
    echo "❌ Unknown chain: $CHAIN"
    echo "Available: $ALL_CHAINS"
    exit 1
  }
  echo "🚰 $INFO"
fi
