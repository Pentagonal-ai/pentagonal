/**
 * Pentagonal — MCP HTTP Endpoint (Streamable HTTP Transport)
 *
 * Exposes all 7 Pentagonal MCP tools over HTTP so Smithery and other
 * agent platforms can discover and use them without a local stdio server.
 *
 * Architecture:
 * - Stateless: each request creates a fresh McpServer (no session state in serverless)
 * - Tools call the Pentagonal web API for AI tasks (audit, generate, fix)
 * - Token lookup (`pentagonal_lookup`) is direct — no AI, just data APIs
 * - Auth: pass `x-pentagonal-api-key` or `x-pentagonal-key` headers → forwarded to API routes
 *
 * Smithery discovery:
 * - POST /api/mcp  → JSON-RPC (initialize, tools/list, tools/call)
 * - GET  /api/mcp  → SSE stream
 *
 * Compatible with MCP SDK 1.12.x WebStandardStreamableHTTPServerTransport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { lookupToken } from '@/lib/mcp-intel';

// Allow up to 60s for tool calls (audit is long — but Smithery mostly does initialize + tools/list)
export const maxDuration = 60;

// ─── Base URL for forwarding tool calls to Pentagonal API ─────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pentagonal.ai';

// ─── Build a fresh McpServer for each stateless request ───────────────────────

function buildServer(authHeaders: Record<string, string>): McpServer {
  const server = new McpServer({
    name: 'pentagonal',
    version: '1.0.0',
  });

  // ─── Tool: pentagonal_lookup ────────────────────────────────────────────────
  server.tool(
    'pentagonal_lookup',
    'One-stop token intelligence. Returns price, market cap, ATH, 24h volume, transactions, holders, liquidity, LP lock status, security flags (honeypot, mintable, pausable, taxes), socials, and verified source code for any token by contract address. Supports Ethereum, Solana, Polygon, Base, Arbitrum, Optimism, and BSC.',
    {
      address: z.string().describe('Contract address (EVM 0x... or Solana base58)'),
      chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum'),
      fields: z.array(
        z.enum(['price', 'market', 'liquidity', 'holders', 'security', 'socials', 'code', 'all'])
      ).default(['all']).describe('Which sections to return. Use specific fields for faster queries.'),
    },
    async ({ address, chain, fields }) => {
      try {
        const res = await fetch(`${BASE_URL}/api/fetch-contract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ address, chainId: chain, fields }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { content: [{ type: 'text', text: `❌ Lookup failed (${res.status}): ${err.error || res.statusText}` }], isError: true };
        }
        const data = await res.json();
        // Format the response using the same intel report logic
        const { report } = await lookupToken(data);
        return { content: [{ type: 'text', text: report }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Lookup error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_audit ─────────────────────────────────────────────────
  server.tool(
    'pentagonal_audit',
    'Run a full 8-agent security pen test on a smart contract. Agents specialize in reentrancy, flash loans, access control, gas griefing, oracle manipulation, MEV/front-running, integer overflow, and economic exploits. Returns findings grouped by severity (Critical → High → Medium → Low) with PoC exploits, line numbers, and remediation steps.',
    {
      code: z.string().describe('Solidity or Anchor/Rust smart contract source code'),
      chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum'),
      use_learned_rules: z.boolean().default(true).describe('Apply accumulated security rules from past audits'),
    },
    async ({ code, chain, use_learned_rules }) => {
      try {
        // Audit streams SSE — collect all chunks into a final result
        const res = await fetch(`${BASE_URL}/api/audit-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ code, chain, learningOn: use_learned_rules }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { content: [{ type: 'text', text: `❌ Audit failed (${res.status}): ${err.error || res.statusText}` }], isError: true };
        }
        // Collect SSE stream
        const text = await collectSSE(res);
        return { content: [{ type: 'text', text: text }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Audit error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_generate ──────────────────────────────────────────────
  server.tool(
    'pentagonal_generate',
    'Generate a production-quality smart contract from a natural language description. Supports EVM (Solidity/OpenZeppelin) and Solana (Anchor/Rust programs or SPL token configs). Uses self-learning security rules from past audits.',
    {
      prompt: z.string().describe('Natural language description of the contract'),
      chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum'),
      solana_type: z.enum(['program', 'token']).optional().describe('Solana only: program (Anchor/Rust) or token (SPL config)'),
      use_learned_rules: z.boolean().default(true),
    },
    async ({ prompt, chain, solana_type, use_learned_rules }) => {
      try {
        const res = await fetch(`${BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ prompt, chain, solanaType: solana_type, learningOn: use_learned_rules }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { content: [{ type: 'text', text: `❌ Generation failed (${res.status}): ${err.error || res.statusText}` }], isError: true };
        }
        const text = await collectSSE(res);
        return { content: [{ type: 'text', text: `✅ Contract generated for ${chain}\n\n${text}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Generation error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_fix ───────────────────────────────────────────────────
  server.tool(
    'pentagonal_fix',
    'Fix a specific vulnerability in a smart contract while preserving all existing functionality. Call once per finding, starting with critical severity.',
    {
      code: z.string().describe('Smart contract source code containing the vulnerability'),
      finding_title: z.string().describe('Title of the finding from the audit report'),
      finding_description: z.string().describe('Description of the vulnerability and its impact'),
    },
    async ({ code, finding_title, finding_description }) => {
      try {
        const res = await fetch(`${BASE_URL}/api/fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ code, finding: { title: finding_title, description: finding_description } }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { content: [{ type: 'text', text: `❌ Fix failed (${res.status}): ${err.error || res.statusText}` }], isError: true };
        }
        const data = await res.json();
        return { content: [{ type: 'text', text: `✅ Fixed: ${finding_title}\n\n${data.code}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Fix error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_compile ───────────────────────────────────────────────
  server.tool(
    'pentagonal_compile',
    'Compile Solidity source code to ABI, bytecode, constructor arguments, and gas estimates. Returns everything needed for deployment with Foundry, Hardhat, or cast.',
    {
      code: z.string().describe('Solidity source code to compile'),
      contract_name: z.string().optional().describe('Specific contract name to extract (defaults to first found)'),
    },
    async ({ code, contract_name }) => {
      try {
        const res = await fetch(`${BASE_URL}/api/compile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ sourceCode: code, contractName: contract_name }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { content: [{ type: 'text', text: `❌ Compilation failed (${res.status}): ${err.error || res.statusText}` }], isError: true };
        }
        const data = await res.json();
        if (!data.success) {
          const errs = (data.errors || []).map((e: { message: string }) => e.message).join('\n');
          return { content: [{ type: 'text', text: `❌ Compilation errors:\n${errs}` }], isError: true };
        }
        const output = [
          `✅ Compiled: ${data.contractName}`,
          `📦 Bytecode size: ${data.bytecodeSize} bytes`,
          data.gasEstimates?.total ? `⛽ Estimated deploy gas: ${data.gasEstimates.total}` : '',
          `\n**ABI:**\n\`\`\`json\n${JSON.stringify(data.abi, null, 2)}\n\`\`\``,
          `\n**Bytecode:**\n\`\`\`\n${data.bytecode}\n\`\`\``,
          data.constructorArgs?.length > 0 ? `\n**Constructor args:** ${JSON.stringify(data.constructorArgs)}` : '',
        ].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text: output }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Compile error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_rules ─────────────────────────────────────────────────
  server.tool(
    'pentagonal_rules',
    'View the accumulated security rules knowledge base. Pentagonal learns from every audit and extracts generalizable rules. Check this to see the current state of the self-learning system.',
    {},
    async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/rules-count`, {
          headers: authHeaders,
        });
        if (!res.ok) return { content: [{ type: 'text', text: '❌ Could not fetch rules' }], isError: true };
        const data = await res.json();
        const rules: string[] = data.rules || [];
        if (rules.length === 0) return { content: [{ type: 'text', text: '📚 No rules accumulated yet. Run audits to build the knowledge base.' }] };
        return { content: [{ type: 'text', text: `📚 ${rules.length} security rules accumulated:\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}` }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `❌ Rules error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    }
  );

  // ─── Tool: pentagonal_chains ────────────────────────────────────────────────
  server.tool(
    'pentagonal_chains',
    'List all supported blockchains with chain IDs, explorer URLs, and deployment details.',
    {},
    async () => {
      const chains = [
        { name: 'Ethereum', id: 'ethereum', chainId: 1, explorer: 'https://etherscan.io' },
        { name: 'Base', id: 'base', chainId: 8453, explorer: 'https://basescan.org' },
        { name: 'Polygon', id: 'polygon', chainId: 137, explorer: 'https://polygonscan.com' },
        { name: 'Arbitrum One', id: 'arbitrum', chainId: 42161, explorer: 'https://arbiscan.io' },
        { name: 'Optimism', id: 'optimism', chainId: 10, explorer: 'https://optimistic.etherscan.io' },
        { name: 'BNB Smart Chain', id: 'bsc', chainId: 56, explorer: 'https://bscscan.com' },
        { name: 'Solana', id: 'solana', chainId: null, explorer: 'https://solscan.io' },
      ];
      const text = chains.map(c =>
        `• **${c.name}** (\`${c.id}\`) — Chain ID: ${c.chainId ?? 'N/A'} — ${c.explorer}`
      ).join('\n');
      return { content: [{ type: 'text', text: `🔗 Supported chains:\n\n${text}` }] };
    }
  );

  return server;
}

// ─── SSE collector — reads an SSE stream and extracts the final text ──────────

async function collectSSE(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '(no response body)';

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    done = streamDone;
    if (value) {
      const text = decoder.decode(value);
      // Parse SSE data lines
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) chunks.push(payload.text);
            if (payload.error) return `❌ ${payload.error}`;
          } catch { /* skip malformed */ }
        }
      }
    }
  }

  return chunks.join('') || '(empty response)';
}

// ─── Next.js Route Handlers ───────────────────────────────────────────────────

function getAuthHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = req.headers.get('x-pentagonal-api-key');
  const mcpKey = req.headers.get('x-pentagonal-key');
  if (apiKey) headers['x-pentagonal-api-key'] = apiKey;
  if (mcpKey) headers['x-pentagonal-key'] = mcpKey;
  return headers;
}

export async function POST(req: NextRequest) {
  const authHeaders = getAuthHeaders(req);
  const server = buildServer(authHeaders);

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless — no session IDs for serverless compatibility
    enableJsonResponse: true, // Return JSON for simple request/response (no SSE overhead)
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: NextRequest) {
  const authHeaders = getAuthHeaders(req);
  const server = buildServer(authHeaders);

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: false, // GET = SSE stream
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  const transport = new WebStandardStreamableHTTPServerTransport({});
  return transport.handleRequest(req);
}
