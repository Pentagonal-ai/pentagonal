#!/usr/bin/env node
// ─── Pentagonal MCP Test Harness ───
// Tests all 6 tools via JSON-RPC over stdio

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'dist', 'index.js');

const SIMPLE_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SimpleToken {
    string public name;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    constructor(string memory _name, uint256 _supply) {
        name = _name;
        totalSupply = _supply;
        balanceOf[msg.sender] = totalSupply;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}`;

class MCPTestClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
  }

  async start() {
    this.proc = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PENTAGONAL_RULES_PATH: path.join(__dirname, '..', 'pentagonal-rules.md'),
      },
    });

    this.proc.stdout.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)(msg);
          }
        } catch {}
      }
    });

    this.proc.stderr.on('data', (data) => {
      // Server logs go to stderr — ignore
    });

    // Initialize
    const initResult = await this.send('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'forge-test', version: '1.0' },
    });

    // Send initialized notification
    this.proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }) + '\n');

    return initResult;
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, resolve);
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.proc.stdin.write(msg + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 60000);
    });
  }

  async callTool(name, args = {}) {
    return this.send('tools/call', { name, arguments: args });
  }

  stop() {
    this.proc.kill();
  }
}

// ─── Run Tests ───

async function main() {
  const client = new MCPTestClient();
  let passed = 0;
  let failed = 0;

  console.log('🔺 Pentagonal MCP Server — Test Suite\n');
  console.log('─'.repeat(60));

  // 1. Initialize
  try {
    const init = await client.start();
    const info = init.result?.serverInfo;
    console.log(`\n✅ INIT: Server ${info?.name} v${info?.version}`);
    console.log(`   Protocol: ${init.result?.protocolVersion}`);
    console.log(`   Capabilities: ${JSON.stringify(init.result?.capabilities)}`);
    passed++;
  } catch (e) {
    console.log(`\n❌ INIT: ${e.message}`);
    failed++;
    process.exit(1);
  }

  // 2. List tools
  try {
    const toolsList = await client.send('tools/list');
    const tools = toolsList.result?.tools || [];
    console.log(`\n✅ TOOLS/LIST: ${tools.length} tools registered`);
    for (const t of tools) {
      console.log(`   🔧 ${t.name}`);
    }
    if (tools.length !== 7) throw new Error(`Expected 7 tools, got ${tools.length}`);
    passed++;
  } catch (e) {
    console.log(`\n❌ TOOLS/LIST: ${e.message}`);
    failed++;
  }

  // 3. pentagonal_chains
  try {
    const result = await client.callTool('pentagonal_chains');
    const text = result.result?.content?.[0]?.text || '';
    const chainCount = (text.match(/—/g) || []).length;
    console.log(`\n✅ CHAINS: ${chainCount} chains`);
    console.log(`   ${text.split('\n').slice(0, 3).join('\n   ')}...`);
    passed++;
  } catch (e) {
    console.log(`\n❌ CHAINS: ${e.message}`);
    failed++;
  }

  // 4. pentagonal_rules
  try {
    const result = await client.callTool('pentagonal_rules');
    const text = result.result?.content?.[0]?.text || '';
    const ruleMatch = text.match(/(\d+) learned/);
    console.log(`\n✅ RULES: ${ruleMatch ? ruleMatch[1] : '?'} rules loaded`);
    console.log(`   ${text.split('\n').slice(0, 2).join('\n   ')}...`);
    passed++;
  } catch (e) {
    console.log(`\n❌ RULES: ${e.message}`);
    failed++;
  }

  // 5. pentagonal_compile
  try {
    const result = await client.callTool('pentagonal_compile', {
      code: SIMPLE_CONTRACT,
    });
    const text = result.result?.content?.[0]?.text || '';
    const isError = result.result?.isError;
    if (isError) throw new Error(text);
    const hasABI = text.includes('ABI');
    const hasBytecode = text.includes('Bytecode');
    console.log(`\n✅ COMPILE: Success`);
    console.log(`   ${text.split('\n').slice(0, 4).join('\n   ')}`);
    if (!hasABI || !hasBytecode) throw new Error('Missing ABI or Bytecode in output');
    passed++;
  } catch (e) {
    console.log(`\n❌ COMPILE: ${e.message}`);
    failed++;
  }

  // 6. pentagonal_lookup (live API call — tests public/key auth path)
  try {
    console.log(`\n⏳ LOOKUP: Fetching SHIB token intelligence...`);
    const result = await client.callTool('pentagonal_lookup', {
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      chain: 'ethereum',
      fields: ['security', 'market'],
    });
    const text = result.result?.content?.[0]?.text || '';
    const isError = result.result?.isError;
    if (isError) throw new Error(text);
    const hasMarket  = text.includes('Market') || text.includes('Price');
    const hasSecurity = text.includes('Honeypot') || text.includes('Security');
    if (!hasMarket || !hasSecurity) throw new Error('Missing expected sections in lookup response');
    console.log(`✅ LOOKUP: Token intelligence returned`);
    console.log(`   ${text.split('\n').slice(0, 5).join('\n   ')}...`);
    passed++;
  } catch (e) {
    console.log(`\n❌ LOOKUP: ${e.message}`);
    failed++;
  }

  // 7. pentagonal_generate (requires ANTHROPIC_API_KEY)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log(`\n⏳ GENERATE: Calling Claude (this takes ~15s)...`);
      const result = await client.callTool('pentagonal_generate', {
        prompt: 'Simple ERC-20 token called TestCoin with symbol TST and 1 million supply',
        chain: 'ethereum',
        use_learned_rules: true,
      });
      const text = result.result?.content?.[0]?.text || '';
      const isError = result.result?.isError;
      if (isError) throw new Error(text);
      const hasContract = text.includes('contract') || text.includes('pragma');
      console.log(`✅ GENERATE: Contract generated (${text.length} chars)`);
      console.log(`   ${text.split('\n').slice(0, 3).join('\n   ')}...`);
      if (!hasContract) throw new Error('Output does not look like a contract');
      passed++;
    } catch (e) {
      console.log(`❌ GENERATE: ${e.message}`);
      failed++;
    }
  } else {
    console.log(`\n⏭️  GENERATE: Skipped (no ANTHROPIC_API_KEY)`);
  }

  // 7. pentagonal_audit (requires ANTHROPIC_API_KEY)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log(`\n⏳ AUDIT: Running 8-agent pen test (this takes ~20s)...`);
      const result = await client.callTool('pentagonal_audit', {
        code: SIMPLE_CONTRACT,
        chain: 'ethereum',
        use_learned_rules: true,
      });
      const text = result.result?.content?.[0]?.text || '';
      const isError = result.result?.isError;
      if (isError) throw new Error(text);
      console.log(`✅ AUDIT: Complete`);
      console.log(`   ${text.split('\n').slice(0, 5).join('\n   ')}...`);
      passed++;
    } catch (e) {
      console.log(`❌ AUDIT: ${e.message}`);
      failed++;
    }
  } else {
    console.log(`⏭️  AUDIT: Skipped (no ANTHROPIC_API_KEY)`);
  }

  // ─── Summary ───
  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  console.log(failed === 0 ? '🟢 All tests passed!' : '🔴 Some tests failed.');

  client.stop();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
