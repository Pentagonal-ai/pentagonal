---
name: pentagonal-clawd
description: Use when the user asks to create, generate, build, audit, fix, or compile smart contracts. Pentagonal Clawd is a sovereign smart contract forge with AI-powered 8-agent security pen testing across Ethereum, Solana, Polygon, Base, Arbitrum, Optimism, and BSC.
---

# Pentagonal Clawd — Smart Contract Forge

You have access to **Pentagonal**, a sovereign smart contract creation and security platform. It generates production-quality contracts, runs 8-agent security pen tests, auto-fixes vulnerabilities, and compiles to deployment-ready ABI + bytecode.

## Available Tools

| Tool | Purpose |
|------|---------|
| `pentagonal_generate` | Create a smart contract from natural language |
| `pentagonal_audit` | Run 8-agent security pen test (reentrancy, flash loans, access control, gas, oracles, MEV, overflow, economic) |
| `pentagonal_fix` | Fix a specific vulnerability while preserving all functionality |
| `pentagonal_compile` | Compile Solidity → ABI + bytecode + constructor args + gas estimates |
| `pentagonal_rules` | View learned security rules (grows with every audit) |
| `pentagonal_chains` | List supported blockchains (Ethereum, Polygon, Base, Solana, etc.) |

## Mandatory Workflow

**ALWAYS follow this pipeline. Never skip the audit step.**

```
1. GENERATE  →  2. AUDIT  →  3. FIX (if needed)  →  4. RE-AUDIT  →  5. COMPILE
```

### Step-by-step:

1. **Generate** the contract from the user's description
   - Ask which chain if not specified. Default to `ethereum`.
   - For Solana, determine if they want a `program` (Anchor/Rust) or `token` (SPL config).
   - Always set `use_learned_rules: true` for safer output.

2. **Audit** the generated code immediately
   - Present findings grouped by severity: Critical → High → Medium → Low
   - If critical or high findings exist, proceed to step 3.
   - If only low/medium or clean, proceed to step 5.

3. **Fix** each critical and high finding
   - Call `pentagonal_fix` once per finding, starting with critical.
   - After fixing, the code is updated — use the latest version for the next fix.

4. **Re-audit** the fixed code
   - Confirm all critical/high issues are resolved.
   - If new issues appeared, fix those too.
   - Repeat until the audit is clean (or only low/medium remain).

5. **Compile** the final, audited code
   - Present the ABI, bytecode, and constructor arguments.
   - If compilation fails, the code likely has import issues — ask the AI to regenerate with self-contained code.

## Chain Selection Guide

| User Intent | Recommended Chain |
|---|---|
| Default / no preference | `ethereum` |
| Cheap deployment / testing | `base` or `polygon` |
| Speed / low latency | `arbitrum` or `optimism` |
| BNB ecosystem | `bsc` |
| SPL tokens / Rust programs | `solana` |
| Maximum security / prestige | `ethereum` |

## Important Rules

1. **NEVER skip the audit step** — every generated contract must be audited before presenting to the user
2. **ALWAYS fix critical and high findings** before compiling
3. **NEVER handle private keys** — output deployment commands/scripts instead
4. **Default to `use_learned_rules: true`** — the self-learning system is Pentagonal's core advantage
5. **Present findings clearly** — group by severity, include line numbers, explain the risk
6. **Ask about chain preference** if the user doesn't specify one
7. **For Solana**, always clarify: program (Anchor/Rust) or token (SPL config)?

## Self-Learning System

Pentagonal accumulates security knowledge with every audit. Each audit extracts generalized security rules from findings and injects them into future prompts. Always keep `use_learned_rules: true`.

Use `pentagonal_rules` to inspect the current knowledge base.

## Deployment & Examples

See [references/deployment.md](references/deployment.md) for deployment commands (Foundry, Hardhat, Anchor) and [references/examples.md](references/examples.md) for conversation flow examples.
