#!/usr/bin/env bash
# pentagonal-compile.sh — Compile Solidity contracts via Pentagonal API
set -euo pipefail

API="${PENTAGONAL_API_URL:-http://localhost:3000}"
FILE=""

usage() {
  echo "Usage: pentagonal-compile.sh --file <path.sol>"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[[ -z "$FILE" ]] && usage
[[ ! -f "$FILE" ]] && echo "❌ File not found: $FILE" && exit 1

CODE=$(cat "$FILE")

BODY=$(jq -n --arg code "$CODE" '{sourceCode: $code}')

echo "⚙️  Compiling $(basename "$FILE")..."

RESPONSE=$(curl -s -X POST "$API/api/compile" \
  -H "Content-Type: application/json" \
  -d "$BODY")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [[ "$SUCCESS" != "true" ]]; then
  echo "❌ Compilation failed:"
  echo "$RESPONSE" | jq -r '.errors[]?.message // .error // "Unknown error"'
  exit 1
fi

CONTRACT=$(echo "$RESPONSE" | jq -r '.contractName')
BYTECODE_LEN=$(echo "$RESPONSE" | jq -r '.bytecode | length // 0')
SOLC=$(echo "$RESPONSE" | jq -r '.solcVersion // "unknown"')
ARG_COUNT=$(echo "$RESPONSE" | jq '.constructorArgs | length // 0')
GAS=$(echo "$RESPONSE" | jq -r '.gasEstimates.total // "N/A"')

echo ""
echo "✅ Compilation successful"
echo "   Contract:    $CONTRACT"
echo "   Bytecode:    $((BYTECODE_LEN / 2)) bytes"
echo "   Solc:        $SOLC"
echo "   Constructor: $ARG_COUNT arguments"
echo "   Est. Gas:    $GAS"

if [[ "$ARG_COUNT" -gt 0 ]]; then
  echo ""
  echo "   Constructor Arguments:"
  echo "$RESPONSE" | jq -r '.constructorArgs[] | "     - " + .name + " (" + .type + ")"'
fi
