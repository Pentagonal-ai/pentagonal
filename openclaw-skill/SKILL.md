---
name: pentagonal
description: Smart contract security auditor and deployment assistant. Generates, audits, and deploys Solidity/Rust smart contracts with AI-powered vulnerability detection across EVM and Solana chains.
metadata:
  openclaw:
    requires:
      bins: ["curl", "jq"]
      env: ["PENTAGONAL_API_URL"]
    user-invocable: true
---

# Pentagonal — Smart Contract Security & Deployment

Use this skill when the user asks about:
- Auditing smart contracts for vulnerabilities
- Generating Solidity or Anchor/Rust smart contracts
- Deploying contracts to EVM or Solana chains
- Checking contract security or finding bugs
- Creating ERC20/ERC721/SPL tokens

## Setup

Set `PENTAGONAL_API_URL` to your Pentagonal instance (default: `https://www.pentagonal.ai`).

```bash
export PENTAGONAL_API_URL="https://www.pentagonal.ai"
```

## Capabilities

### 1. Generate Smart Contracts

Generate AI-powered smart contracts from natural language descriptions.

```bash
# EVM (Solidity)
bash scripts/pentagonal-generate.sh --chain ethereum --prompt "ERC20 token with burn and pause"

# Solana (Anchor/Rust)
bash scripts/pentagonal-generate.sh --chain solana --type program --prompt "Escrow program with time lock"

# Solana (SPL Token)
bash scripts/pentagonal-generate.sh --chain solana --type token --prompt "Governance token with 1B supply"
```

### 2. Audit Smart Contracts

Run AI-powered security audits on existing contract code.

```bash
# Audit from file
bash scripts/pentagonal-audit.sh --file ./contracts/MyToken.sol

# Audit from stdin
cat contract.sol | bash scripts/pentagonal-audit.sh --stdin

# Audit with specific focus
bash scripts/pentagonal-audit.sh --file ./contracts/MyToken.sol --focus "reentrancy,access-control"
```

The audit returns findings classified by severity:
- 🔴 **Critical** — Must fix before deployment
- 🟠 **High** — Likely exploitable
- 🟡 **Medium** — Potential issue
- 🔵 **Low** — Best practice suggestion
- ⚪ **Info** — Informational note

### 3. Deploy Contracts

Deploy compiled contracts to supported chains.

**Supported EVM Chains:**
- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy)
- BSC (Mainnet, Testnet)
- Arbitrum (Mainnet, Sepolia)
- Base (Mainnet, Sepolia)
- Optimism (Mainnet, Sepolia)
- Avalanche (Mainnet, Fuji)

**Supported Solana:**
- SPL Token creation (Devnet, Mainnet)
- Anchor program deployment (via Solana Playground guided walkthrough)

```bash
# Compile and show deployment info
bash scripts/pentagonal-compile.sh --file ./contracts/MyToken.sol

# Get testnet faucet links
bash scripts/pentagonal-faucet.sh --chain sepolia
```

### 4. Check Deployment History

```bash
# List past deployments
bash scripts/pentagonal-history.sh
```

## Workflow: Full Audit-to-Deploy Pipeline

When the user wants to go from idea to deployment:

1. **Generate**: Create the contract from their description
2. **Review**: Show the generated code and explain key functions
3. **Audit**: Run the security audit and present findings
4. **Fix**: Apply auto-fixes for any findings (if available)
5. **Deploy**: Guide them through deployment to their chosen chain

Always recommend deploying to a testnet first. Never skip the audit step.

## Tips

- Always audit before deploying — even generated contracts can have issues
- For Solana programs, recommend Solana Playground (beta.solpg.io) for deployment
- Testnet faucets are available for all supported chains
- The audit API supports both Solidity and Rust/Anchor code
- Constructor arguments are auto-detected from the compiled ABI
