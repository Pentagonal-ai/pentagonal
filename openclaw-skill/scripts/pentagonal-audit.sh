#!/usr/bin/env bash
# pentagonal-audit.sh — Run security audits on smart contracts via Pentagonal API
set -euo pipefail

API="${PENTAGONAL_API_URL:-http://localhost:3000}"
FILE=""
STDIN=false
FOCUS=""

usage() {
  echo "Usage: pentagonal-audit.sh --file <path> | --stdin [--focus <categories>]"
  echo ""
  echo "Options:"
  echo "  --file    Path to the contract file (*.sol or *.rs)"
  echo "  --stdin   Read contract code from stdin"
  echo "  --focus   Comma-separated focus areas (e.g., reentrancy,access-control)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --stdin) STDIN=true; shift ;;
    --focus) FOCUS="$2"; shift 2 ;;
    *) usage ;;
  esac
done

# Read code
if [[ "$STDIN" == true ]]; then
  CODE=$(cat)
elif [[ -n "$FILE" ]]; then
  [[ ! -f "$FILE" ]] && echo "❌ File not found: $FILE" && exit 1
  CODE=$(cat "$FILE")
else
  usage
fi

[[ -z "$CODE" ]] && echo "❌ No code provided" && exit 1

# Detect chain from file extension or content
if echo "$CODE" | grep -q "use anchor_lang"; then
  CHAIN="solana"
elif echo "$CODE" | grep -q "pragma solidity"; then
  CHAIN="ethereum"
else
  CHAIN="ethereum"
fi

# Build request
BODY=$(jq -n \
  --arg code "$CODE" \
  --arg chain "$CHAIN" \
  --arg focus "$FOCUS" \
  '{code: $code, chain: $chain, focus: $focus}')

echo "🔍 Auditing contract ($(echo "$CODE" | wc -l | tr -d ' ') lines, chain: $CHAIN)..."

RESPONSE=$(curl -s -X POST "$API/api/audit" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Check for errors
ERROR=$(echo "$RESPONSE" | jq -r '.error // ""')
if [[ -n "$ERROR" ]]; then
  echo "❌ Audit failed: $ERROR"
  exit 1
fi

# Format output
SCORE=$(echo "$RESPONSE" | jq -r '.score // "N/A"')
FINDINGS_COUNT=$(echo "$RESPONSE" | jq '.findings | length // 0')

echo ""
echo "═══════════════════════════════════════════"
echo "  Security Score: $SCORE/100"
echo "  Findings: $FINDINGS_COUNT"
echo "═══════════════════════════════════════════"
echo ""

# Print findings by severity
echo "$RESPONSE" | jq -r '.findings[] | 
  (if .severity == "critical" then "🔴 CRITICAL" 
   elif .severity == "high" then "🟠 HIGH"
   elif .severity == "medium" then "🟡 MEDIUM"
   elif .severity == "low" then "🔵 LOW"
   else "⚪ INFO" end) + ": " + .title + "\n   " + .description + "\n"' 2>/dev/null || true

# Print suggestions
echo "$RESPONSE" | jq -r 'if .suggestions then "💡 Suggestions:\n" + (.suggestions | join("\n")) else "" end' 2>/dev/null || true

echo ""
echo "Run with --focus to narrow the audit (e.g., --focus reentrancy,access-control)"
