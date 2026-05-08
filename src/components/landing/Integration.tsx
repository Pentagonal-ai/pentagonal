import { InstallChip } from './InstallChip';

export function Integration() {
  return (
    <section className="m-section" id="integration">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Integration</span>
          <h2 className="m-h2">
            Two ways in.
            One for humans, one for agents.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Pentagonal ships a native Model Context Protocol server for the
            IDE you&rsquo;re already in, and an x402 endpoint so autonomous
            agents can pay per call in USDC — no account, no key
            management.
          </p>
        </div>

        <div className="m-int-grid">
          <div className="m-int-card">
            <div className="m-int-card-head">
              <div>
                <div className="m-int-card-kicker">For humans · MCP</div>
                <div className="m-int-card-title">Run audits from your IDE.</div>
              </div>
              <div className="m-int-card-stat">
                <span className="m-int-card-stat-value">v1.0.2</span>
                <span className="m-int-card-stat-label">on npm</span>
              </div>
            </div>

            <p className="m-int-card-body">
              Drop the server into Claude Desktop, Cursor, Windsurf, Cline,
              or Continue. Calls <code>pentagonal_audit</code> against the
              contract in your open buffer. Stdio for desktop, HTTP for
              hosted clients.
            </p>

            <InstallChip command="npx -y pentagonal-mcp" />

            <code className="m-int-code">
{`// claude_desktop_config.json
{
  "mcpServers": {
    "pentagonal": {
      "command": "npx",
      "args": ["-y", "pentagonal-mcp"],
      "env": { "PENTAGONAL_KEY": "your-api-key" }
    }
  }
}`}
            </code>

            <div className="m-int-clients">
              <span className="m-chain-pill">Claude Desktop</span>
              <span className="m-chain-pill">Cursor</span>
              <span className="m-chain-pill">Windsurf</span>
              <span className="m-chain-pill">Cline</span>
              <span className="m-chain-pill">Continue</span>
              <span className="m-chain-pill">HTTP transport</span>
            </div>
          </div>

          <div className="m-int-card">
            <div className="m-int-card-head">
              <div>
                <div className="m-int-card-kicker m-int-card-kicker--accent">For agents · x402</div>
                <div className="m-int-card-title">Pay per call in USDC.</div>
              </div>
              <div className="m-int-card-stat">
                <span className="m-int-card-stat-value">$5</span>
                <span className="m-int-card-stat-label">/ audit · USDC on Base</span>
              </div>
            </div>

            <p className="m-int-card-body">
              Autonomous agents hit the endpoint, get a 402, attach a USDC
              payment header, and retry. No signup, no API key rotation,
              no spend limits to engineer around. The Coinbase x402
              protocol handles settlement on Base.
            </p>

            <code className="m-int-code">
{`# Agent fetches → 402 Payment Required
$ curl https://pentagonal.ai/api/audit \\
    -H "Content-Type: application/json" \\
    -d @vault.json
HTTP/2 402
x-payment-amount: 5.00
x-payment-asset: USDC
x-payment-network: base

# Agent pays and retries
$ curl https://pentagonal.ai/api/audit \\
    -H "X-PAYMENT: <usdc-base-tx>" \\
    -d @vault.json
HTTP/2 200  → audit-report.md`}
            </code>

            <div className="m-int-clients">
              <span className="m-chain-pill">x402 protocol</span>
              <span className="m-chain-pill">USDC · Base</span>
              <span className="m-chain-pill">No account</span>
              <span className="m-chain-pill">Per-call settlement</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
