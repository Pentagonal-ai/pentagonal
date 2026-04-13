# Pentagonal

AI-powered smart contract forge with an 8-agent adversarial security audit system.

Generate, audit, fix, and compile Solidity and Anchor/Rust contracts across 8 chains including Ethereum, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche, and Solana. Includes token intelligence lookups with market data, holder analysis, and honeypot detection. Self-learning security rules engine that improves with every audit.

## MCP Server

Install via npm:

```bash
npx pentagonal-mcp
```

### Claude Desktop

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

### HTTP (Claude Code / Cursor / Windsurf)

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

## Payment

- **Credits** — $5 per audit or generate, buy via the web app (EVM or Solana)
- **x402** — agents pay per-use with USDC on Base (no account needed)
- **API key** — use your credit balance programmatically
- **Free tools** — fix, compile, lookup, rules, chains work for everyone

## Links

- [pentagonal.ai](https://www.pentagonal.ai)
- [npm](https://www.npmjs.com/package/pentagonal-mcp)
- [Smithery](https://smithery.ai/servers/@achilles-safehavencalls/pentagonal)
- [ClawHub](https://clawhub.ai/skills/pentagonal)
- [@Pentagonalai](https://x.com/Pentagonalai)

## License

MIT
