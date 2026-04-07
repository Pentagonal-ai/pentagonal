---
name: pentagonal-clawd
description: Use when the user asks to create, generate, build, audit, fix, compile, or look up smart contracts and tokens. Pentagonal Clawd is a sovereign smart contract forge and token intelligence platform with AI-powered 8-agent security pen testing across Ethereum, Solana, Polygon, Base, Arbitrum, Optimism, and BSC.
---

# Pentagonal Clawd — Smart Contract Forge & Token Intelligence

You have access to **Pentagonal**, a sovereign smart contract creation, security, and token intelligence platform. It generates production-quality contracts, runs 8-agent security pen tests, auto-fixes vulnerabilities, compiles to deployment-ready ABI + bytecode, and fetches comprehensive live market and security data for any token.

## Available Tools

| Tool | Purpose |
|------|---------| 
| `pentagonal_lookup` | **One-stop token intelligence.** Fetches price, market cap, ATH, volume, txns, holders, liquidity, LP lock, security flags, socials, and source code for any token by contract address |
| `pentagonal_generate` | Create a smart contract from natural language |
| `pentagonal_audit` | Run 8-agent security pen test (reentrancy, flash loans, access control, gas, oracles, MEV, overflow, economic) |
| `pentagonal_fix` | Fix a specific vulnerability while preserving all functionality |
| `pentagonal_compile` | Compile Solidity → ABI + bytecode + constructor args + gas estimates |
| `pentagonal_rules` | View learned security rules (grows with every audit) |
| `pentagonal_chains` | List supported blockchains (Ethereum, Polygon, Base, Solana, etc.) |

---

## Workflows

### Workflow A: Research an Existing Token

Use when the user asks about a token, coin, or contract address.

```
1. LOOKUP (pentagonal_lookup)  →  2. AUDIT if user wants security analysis
```

**Step 1 — Full lookup:**
- Call `pentagonal_lookup` with the address and chain. Default `fields: ["all"]` for complete data.
- Present each section clearly: market data, liquidity, holders, security flags, socials.

**Step 2 — Targeted queries:**
- If the user only needs market data: `fields: ["price", "market"]`
- If they only need security info: `fields: ["security"]`
- If they want to audit the code: `fields: ["code"]` then pass the result to `pentagonal_audit`

**Lookup + Audit sequence:**
```
pentagonal_lookup(address, chain, fields=["all"])
  → if verified source code returned:
      pentagonal_audit(code=<source from lookup>, chain=<chain>)
```

---

### Workflow B: Create a New Contract

Use when the user asks to build, generate, or write a smart contract.

```
1. GENERATE  →  2. AUDIT  →  3. FIX (if needed)  →  4. RE-AUDIT  →  5. COMPILE
```

1. **Generate** — `pentagonal_generate(prompt, chain, use_learned_rules=true)`
   - Ask which chain if not specified. Default to `ethereum`.
   - For Solana: clarify `program` (Anchor/Rust) or `token` (SPL config).

2. **Audit** — `pentagonal_audit(code, chain, use_learned_rules=true)`
   - Present findings grouped: Critical → High → Medium → Low
   - If critical/high exist, go to Fix.

3. **Fix** — `pentagonal_fix(code, finding_title, finding_description)`
   - One call per finding, starting with critical.
   - Always use the latest version of the code after each fix.

4. **Re-audit** — Confirm all critical/high issues are resolved.

5. **Compile** — `pentagonal_compile(code)`
   - Present ABI, bytecode, and constructor args.

---

## `pentagonal_lookup` — Field Reference

The `fields` parameter controls what data is returned. Use specific fields to keep responses concise:

| Field | Returns |
|-------|---------|
| `"all"` | Everything (default) |
| `"price"` | Current price and 24h price change |
| `"market"` | Price, market cap, ATH, volume, txns |
| `"liquidity"` | Total liquidity, top DEX, pool count, LP lock |
| `"holders"` | Holder count, owner supply %, rug score (Solana) |
| `"security"` | Honeypot, taxes, mintable, pausable, hidden owner, self-destruct |
| `"socials"` | Website, Twitter/X, Telegram |
| `"code"` | Full verified source code + compiler version |

**Examples:**

```
# Full due diligence on a token
pentagonal_lookup("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "ethereum", ["all"])

# Quick security check only
pentagonal_lookup("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "ethereum", ["security"])

# Pull source code for auditing
pentagonal_lookup("0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", "ethereum", ["code"])

# Solana token intelligence
pentagonal_lookup("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "solana", ["all"])
```

---

## Chain Selection Guide

| User Intent | Recommended Chain |
|---|---|
| Default / no preference | `ethereum` |
| Cheap deployment / testing | `base` or `polygon` |
| Speed / low latency | `arbitrum` or `optimism` |
| BNB ecosystem | `bsc` |
| SPL tokens / Rust programs | `solana` |
| Maximum security / prestige | `ethereum` |

---

## Important Rules

1. **NEVER skip the audit step** when creating contracts — every generated contract must be audited before presenting to the user
2. **ALWAYS fix critical and high findings** before compiling
3. **Use `pentagonal_lookup` first** when researching existing tokens — don't speculate about market data
4. **Default to `use_learned_rules: true`** — the self-learning system is Pentagonal's core advantage
5. **NEVER handle private keys** — output deployment commands/scripts instead
6. **Present findings clearly** — group by severity, include line numbers, explain the risk
7. **For Solana**, always clarify: program (Anchor/Rust) or token (SPL config)?
8. **Field filtering** — use specific `fields` when the user asks a narrow question. Don't pull full code just to answer "what's the market cap?"

---

## Self-Learning System

Pentagonal accumulates security knowledge with every audit. Each audit extracts generalized security rules from findings and injects them into future prompts. Always keep `use_learned_rules: true`.

Use `pentagonal_rules` to inspect the current knowledge base.

---

## Deployment & Examples

See [references/deployment.md](references/deployment.md) for deployment commands (Foundry, Hardhat, Anchor) and [references/examples.md](references/examples.md) for conversation flow examples.
