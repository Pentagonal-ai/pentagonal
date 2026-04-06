#!/bin/bash
# Pentagonal Pipeline Smoke Tests
# Usage: ./scripts/test-audit.sh [BASE_URL]
# Default: production Vercel URL

BASE_URL="${1:-https://pentagonal.vercel.app}"
PASS=0
FAIL=0
WARN=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local name="$1"
  local result="$2"
  local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    echo -e "${GREEN}✅ PASS${NC}: $name"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}: $name"
    echo "   Expected to contain: '$expected'"
    echo "   Got: ${result:0:300}"
    ((FAIL++))
  fi
}

check_status() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC}: $name (HTTP $actual)"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}: $name — expected HTTP $expected, got HTTP $actual"
    ((FAIL++))
  fi
}

warn() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
  ((WARN++))
}

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Pentagonal Pipeline Smoke Tests        ║"
echo "╚══════════════════════════════════════════╝"
echo "Target: $BASE_URL"
echo ""

# ─── T1: Auth Gate ───
echo "── Tier 1: Auth & Endpoint Health ──"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/audit-agent" \
  -H "Content-Type: application/json" \
  -d '{"code":"contract X{}","chain":"evm"}')
check_status "Auth gate on /api/audit-agent (no session → 401)" "$STATUS" "401"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/scope" \
  -H "Content-Type: application/json" \
  -d '{"code":"contract X{}"}')
check_status "Auth gate on /api/scope (no session → 401)" "$STATUS" "401"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/expand-prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}')
check_status "Auth gate on /api/expand-prompt (no session → 401)" "$STATUS" "401"

R=$(curl -s "$BASE_URL/api/rules-count")
check "Rules count endpoint responds" "$R" "count"

# ─── T2: DexScreener Reachability ───
echo ""
echo "── Tier 2: External API Connectivity ──"

R=$(curl -s --max-time 10 "https://api.dexscreener.com/latest/dex/tokens/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE")
check "DexScreener reachable (EVM — SHIB)" "$R" "SHIB"

R=$(curl -s --max-time 10 "https://api.dexscreener.com/latest/dex/tokens/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R")
check "DexScreener reachable (Solana — RAY)" "$R" "RAY"

R=$(curl -s --max-time 10 "https://api.dexscreener.com/latest/dex/tokens/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")
check "DexScreener reachable (Solana — BONK)" "$(echo $R | tr '[:upper:]' '[:lower:]')" "bonk"

# ─── T3: Static Assets ───
echo ""
echo "── Tier 3: Static Assets ──"

STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE_URL/robots.txt")
check_status "robots.txt accessible" "$STATUS" "200"

STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE_URL/llms.txt")
check_status "llms.txt accessible" "$STATUS" "200"

STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/ai-plugin.json")
check_status "ai-plugin.json accessible" "$STATUS" "200"

STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE_URL/sitemap.xml")
check_status "sitemap.xml accessible" "$STATUS" "200"

# ─── T4: Homepage & SEO ───
echo ""
echo "── Tier 4: Homepage & SEO ──"

R=$(curl -s "$BASE_URL")
check "Homepage loads" "$R" "Pentagonal"
check "Meta description present" "$R" "content="
check "og:title present" "$R" "og:title"

# ─── Summary ───
echo ""
echo "══════════════════════════════════════════"
echo "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🟢 ALL SMOKE TESTS PASS — safe to proceed${NC}"
  exit 0
else
  echo -e "${RED}🔴 $FAIL FAILURE(S) — DO NOT migrate until resolved${NC}"
  exit 1
fi

# ─── T5: Logo CDN Validation ───
echo ""
echo "── Tier 5: Token Logo CDNs ──"

# EVM: SHIB (TrustWallet CDN, checksummed address)
STATUS=$(curl -sI "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png" | grep -c "image/png")
[ "$STATUS" -ge 1 ] && check_status "TrustWallet CDN (EVM — SHIB)" "200" "200" || check_status "TrustWallet CDN (EVM — SHIB)" "404" "200"

# Solana: RAY (Solana token list CDN)
STATUS=$(curl -sI "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png" | grep -c "image/png")
[ "$STATUS" -ge 1 ] && check_status "Solana token-list CDN (Solana — RAY)" "200" "200" || check_status "Solana token-list CDN (Solana — RAY)" "404" "200"
