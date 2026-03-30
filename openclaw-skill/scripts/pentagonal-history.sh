#!/usr/bin/env bash
# pentagonal-history.sh — Display deployment history
set -euo pipefail

API="${PENTAGONAL_API_URL:-http://localhost:3000}"

echo "📋 Deployment History"
echo "═══════════════════════════════════════"

# Try to fetch from the running Pentagonal instance localStorage proxy
# Falls back to showing instructions if no API available
RESPONSE=$(curl -s -f "$API/api/deploy-history" 2>/dev/null || echo "")

if [[ -z "$RESPONSE" || "$RESPONSE" == "null" ]]; then
  echo ""
  echo "  No deployment history available via API."
  echo ""
  echo "  Deployment history is stored in your browser's localStorage."
  echo "  Open Pentagonal ($API) and click the 📋 button in the code toolbar"
  echo "  to view your full deployment history."
  echo ""
  exit 0
fi

echo "$RESPONSE" | jq -r '.[] | 
  "\n  " + .contractName + " → " + .chain + 
  " (" + .network + ")" +
  "\n    Address: " + .address +
  "\n    Tx:      " + .txHash[0:10] + "..." + .txHash[-8:] +
  "\n    Time:    " + (.timestamp / 1000 | strftime("%Y-%m-%d %H:%M"))' 2>/dev/null || echo "  No deployments found."
