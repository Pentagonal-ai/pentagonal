# pentagonal-mcp

MCP server for [Pentagonal](https://www.pentagonal.ai) — the AI-powered smart contract forge.

## Tools

| Tool | Description | Auth |
|---|---|---|
| `pentagonal_lookup` | Token intelligence — price, holders, LP lock, honeypot, source code | Free (rate limited) |
| `pentagonal_audit` | 8-agent security pen test with severity grouping and PoC exploits | $5 (credit or x402) |
| `pentagonal_generate` | Generate contracts from natural language (Solidity + Anchor/Rust) | $5 (credit or x402) |
| `pentagonal_fix` | Fix a specific vulnerability while preserving functionality | Free (rate limited) |
| `pentagonal_compile` | Compile Solidity to ABI + bytecode + gas estimates | Free (rate limited) |
| `pentagonal_rules` | View accumulated self-learning security rules | Free |
| `pentagonal_chains` | List all supported blockchains | Free |

Supports **Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, and Solana**.

## Setup

### Claude Desktop (stdio)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pentagonal": {
      "command": "npx",
      "args": ["-y", "pentagonal-mcp"],
      "env": {
        "PENTAGONAL_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code / Cursor / Windsurf (HTTP)

Add to your MCP config:

```json
{
  "mcpServers": {
    "pentagonal": {
      "type": "http",
      "url": "https://www.pentagonal.ai/api/mcp",
      "headers": {
        "x-pentagonal-api-key": "your-api-key"
      }
    }
  }
}
```

## Get an API Key

1. Sign in at [pentagonal.ai](https://www.pentagonal.ai)
2. Click your avatar → **🔑 API Keys**
3. Generate a key — it's shown once, copy it immediately

## Payment Options

- **Credits** — $5 per audit or generate, buy via the web app (EVM or Solana)
- **x402** — agents pay per-use with USDC on Base (no account needed)
- **API key** — use your credit balance programmatically
- **Free tools** — fix, compile, lookup, rules, chains are free for everyone

## Links

- 🌐 [pentagonal.ai](https://www.pentagonal.ai)
- 📦 [GitHub](https://github.com/Pentagonal-ai/pentagonal)
- 🐦 [@Pentagonalai](https://x.com/Pentagonalai)

## License

MIT
