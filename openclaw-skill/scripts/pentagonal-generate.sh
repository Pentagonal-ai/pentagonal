#!/usr/bin/env bash
# pentagonal-generate.sh — Generate smart contracts via the Pentagonal API
set -euo pipefail

API="${PENTAGONAL_API_URL:-http://localhost:3000}"
CHAIN=""
TYPE=""
PROMPT=""

usage() {
  echo "Usage: pentagonal-generate.sh --chain <chain> [--type <token|program>] --prompt <description>"
  echo ""
  echo "Options:"
  echo "  --chain    Chain to target: ethereum, polygon, bsc, arbitrum, base, optimism, avalanche, solana"
  echo "  --type     (solana only) token or program"
  echo "  --prompt   Natural language description of the contract"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chain) CHAIN="$2"; shift 2 ;;
    --type) TYPE="$2"; shift 2 ;;
    --prompt) PROMPT="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[[ -z "$CHAIN" || -z "$PROMPT" ]] && usage

# Map chain names to API chain IDs
declare -A CHAIN_MAP=(
  [ethereum]="ethereum" [eth]="ethereum" [sepolia]="ethereum"
  [polygon]="polygon" [matic]="polygon" [amoy]="polygon"
  [bsc]="bsc" [binance]="bsc"
  [arbitrum]="arbitrum" [arb]="arbitrum"
  [base]="base"
  [optimism]="optimism" [op]="optimism"
  [avalanche]="avalanche" [avax]="avalanche"
  [solana]="solana" [sol]="solana"
)

CHAIN_ID="${CHAIN_MAP[$CHAIN]:-$CHAIN}"

# Build request body
if [[ "$CHAIN_ID" == "solana" ]]; then
  BODY=$(jq -n \
    --arg prompt "$PROMPT" \
    --arg chain "$CHAIN_ID" \
    --arg solanaType "${TYPE:-token}" \
    '{prompt: $prompt, chain: $chain, solanaType: $solanaType}')
else
  BODY=$(jq -n \
    --arg prompt "$PROMPT" \
    --arg chain "$CHAIN_ID" \
    '{prompt: $prompt, chain: $chain}')
fi

echo "🔧 Generating contract on $CHAIN_ID..."

RESPONSE=$(curl -s -X POST "$API/api/generate" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Extract code from response
CODE=$(echo "$RESPONSE" | jq -r '.code // .error // "No code generated"')

if [[ "$CODE" == "No code generated" || "$CODE" == null ]]; then
  echo "❌ Generation failed:"
  echo "$RESPONSE" | jq .
  exit 1
fi

echo "✅ Contract generated:"
echo ""
echo "$CODE"
