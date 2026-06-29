# Deploying Qcipher contracts

Deploys `KeyRegistry` + `Messenger` to Base. Defaults to **Base Sepolia** (testnet).

## Prerequisites

1. A deployer wallet private key, funded on the target chain:
   - **Testnet** — Base Sepolia ETH from a faucet (e.g. the Coinbase / Alchemy Base Sepolia faucet).
   - **Mainnet** — a small amount of Base ETH (deploy costs ~a few cents on Base).
2. Environment:
   ```bash
   export DEPLOYER_PRIVATE_KEY=0x...   # funded deployer (never commit this)
   export QCIPHER_RPC_URL=...          # optional; defaults to the chain's public RPC
   ```

## Deploy

```bash
node scripts/deploy-qcipher.mjs            # Base Sepolia (testnet)
node scripts/deploy-qcipher.mjs --mainnet  # Base mainnet
```

It compiles the contracts, deploys both, and prints the two addresses.

## Wire the app

Copy the printed addresses into `.env.local`:

```bash
NEXT_PUBLIC_QCIPHER_KEY_REGISTRY=0x...
NEXT_PUBLIC_QCIPHER_MESSENGER=0x...
```

For **testnet**, also point the UI at Base Sepolia (`chainId` 84532) in
`src/lib/qcipher/abi.ts`. Then `/messages` register / send / read go live on-chain
(the loopback demo becomes a real conversation).

## After deploy

- The `Messenger` access gate is **unset (open)** by default. Wire a `$PENT` gate
  later with `setGate(gateAddress)` (owner only) once the gate model is chosen.
- `owner` is the deployer. For production, follow the threat model's hardening:
  transfer ownership to a **multisig** and add a **2-step ownership** pattern.
- Contracts should pass the 9-agent Forge audit (and the manual audit on record)
  with no critical/high before mainnet.
