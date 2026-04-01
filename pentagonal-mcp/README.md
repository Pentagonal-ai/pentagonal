# 🔺 Pentagonal MCP Server

Smart Contract Forge for AI models — generate, audit, fix, and compile production-grade smart contracts via [Model Context Protocol](https://modelcontextprotocol.io/).

## Features

- **Generate** smart contracts from natural language (EVM/Solidity + Solana/Anchor)
- **Audit** with 8 specialized security agents (reentrancy, flash loans, access control, etc.)
- **Fix** vulnerabilities automatically while preserving functionality
- **Compile** Solidity to deployment-ready ABI + bytecode
- **Self-learning** rules engine that gets smarter with every audit

## Quick Start

```bash
cd pentagonal-mcp
npm install
npm run build
```

## Claude Desktop / Cursor Configuration

Add to your MCP settings:

```json
{
  "mcpServers": {
    "pentagonal": {
      "command": "node",
      "args": ["/path/to/pentagonal-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for contract generation and auditing |
| `PENTAGONAL_RULES_PATH` | ❌ | Path to rules file (defaults to `./pentagonal-rules.md`) |

## Tools

| Tool | Description |
|------|-------------|
| `pentagonal_generate` | Generate a smart contract from natural language |
| `pentagonal_audit` | Run 8-agent security pen test |
| `pentagonal_fix` | Fix a specific vulnerability |
| `pentagonal_compile` | Compile Solidity → ABI + bytecode |
| `pentagonal_rules` | View learned security rules |
| `pentagonal_chains` | List supported blockchains |

## Claude Skill

The `skill/SKILL.md` file teaches AI models the optimal workflow:

```
Generate → Audit → Fix → Re-audit → Compile → Deploy instructions
```

## Architecture

```
┌──────────────┐    stdio     ┌──────────────────┐
│  Claude /     │ ◀─────────▶ │  pentagonal-mcp  │
│  Cursor /     │   MCP       │                  │
│  Any Client   │             │  ├── Anthropic SDK│
└──────────────┘              │  ├── solc        │
                              │  └── rules.ts   │
                              └──────────────────┘
```

No web server needed. Fully self-contained.

## License

MIT
