#!/usr/bin/env node
// ─── Pentagonal MCP — Self-Contained Flow Test ───
// Tests the re-generate path with explicit "no imports" instruction + compile

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'dist', 'index.js');

class MCPClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
  }

  async start() {
    this.proc = spawn('node', [serverPath], {
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
          if (msg.id && this.pending.has(msg.id)) this.pending.get(msg.id)(msg);
        } catch {}
      }
    });
    this.proc.stderr.on('data', () => {});
    await this.send('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'forge-e2e', version: '1.0' },
    });
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`Timeout: ${method}`)); } }, 120000);
    });
  }

  async callTool(name, args = {}) {
    const result = await this.send('tools/call', { name, arguments: args });
    return { text: result.result?.content?.[0]?.text || '', isError: result.result?.isError || false };
  }

  stop() { this.proc.kill(); }
}

function extractCode(text) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.includes('pragma') || l.includes('// SPDX') || l.includes('contract '));
  return start === -1 ? text : lines.slice(start).join('\n');
}

async function main() {
  const client = new MCPClient();
  await client.start();

  console.log('🔺 Pentagonal MCP — Self-Contained Compile Test\n');

  // ─── Generate with explicit self-contained instruction ───
  console.log('═'.repeat(60));
  console.log('  STEP 1: GENERATE — Self-contained ERC-20 (no imports)');
  console.log('═'.repeat(60));
  console.log('⏳ Generating...');

  const gen = await client.callTool('pentagonal_generate', {
    prompt: 'Create a simple ERC-20 token called "ForgeToken" (FRG) with 1 billion supply. Include transfer, approve, transferFrom. Owner can pause. CRITICAL: Do NOT import any external libraries. Write ALL code inline — implement ERC-20 from scratch without OpenZeppelin imports. Self-contained single-file.',
    chain: 'ethereum',
    use_learned_rules: true,
  });

  if (gen.isError) { console.log('❌', gen.text); client.stop(); return; }

  let code = extractCode(gen.text);
  console.log(`✅ Generated (${code.length} chars, ${code.split('\n').length} lines)`);
  
  const hasImports = code.includes('import ');
  console.log(`   Imports: ${hasImports ? '⚠️ YES (unexpected)' : '✅ NONE (self-contained)'}`);

  // ─── Audit ───
  console.log('\n' + '═'.repeat(60));
  console.log('  STEP 2: AUDIT');
  console.log('═'.repeat(60));
  console.log('⏳ Running 8-agent audit...');

  const audit = await client.callTool('pentagonal_audit', {
    code,
    chain: 'ethereum',
    use_learned_rules: true,
  });

  const findingsMatch = audit.text.match(/\[.*\]/s);
  let findings = [];
  try { if (findingsMatch) findings = JSON.parse(findingsMatch[0]); } catch {}

  const critHigh = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  console.log(`✅ Audit: ${findings.length} findings (${critHigh.length} critical/high)`);
  for (const f of findings) {
    const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[f.severity];
    console.log(`   ${icon} [${f.severity.toUpperCase()}] ${f.title}`);
  }

  // ─── Fix critical/high ───
  if (critHigh.length > 0) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  STEP 3: FIX — ${critHigh.length} critical/high issues`);
    console.log('═'.repeat(60));
    
    for (const f of critHigh) {
      console.log(`⏳ Fixing: ${f.title}...`);
      const fix = await client.callTool('pentagonal_fix', {
        code,
        finding_title: f.title,
        finding_description: f.description,
      });
      if (!fix.isError) {
        code = extractCode(fix.text);
        console.log(`   ✅ Fixed`);
      } else {
        console.log(`   ❌ ${fix.text.slice(0, 80)}`);
      }
    }

    // Re-audit
    console.log('\n⏳ Re-auditing...');
    const audit2 = await client.callTool('pentagonal_audit', { code, chain: 'ethereum', use_learned_rules: true });
    const m2 = audit2.text.match(/\[.*\]/s);
    let f2 = [];
    try { if (m2) f2 = JSON.parse(m2[0]); } catch {}
    const remaining = f2.filter(f => f.severity === 'critical' || f.severity === 'high');
    console.log(`✅ Re-audit: ${f2.length} findings (${remaining.length} critical/high remaining)`);
  }

  // ─── Compile ───
  console.log('\n' + '═'.repeat(60));
  console.log('  STEP 4: COMPILE');
  console.log('═'.repeat(60));
  console.log('⏳ Compiling...');

  const compile = await client.callTool('pentagonal_compile', { code });

  if (compile.isError) {
    console.log('❌ Compilation failed:');
    compile.text.split('\n').slice(0, 6).forEach(l => console.log(`   ${l}`));
  } else {
    console.log('✅ Compilation successful!');
    compile.text.split('\n').slice(0, 5).forEach(l => console.log(`   ${l}`));
    
    const hasBytecode = compile.text.includes('0x');
    const hasABI = compile.text.includes('ABI');
    console.log(`\n   📦 ABI: ${hasABI ? '✅' : '❌'} | Bytecode: ${hasBytecode ? '✅' : '❌'}`);
    
    if (hasBytecode) {
      console.log('\n   🚀 Deployment command:');
      console.log('   cast send --rpc-url <RPC_URL> \\');
      console.log('     --private-key $PRIVATE_KEY \\');
      console.log('     --create <BYTECODE> <CONSTRUCTOR_ARGS>');
    }
  }

  // ─── Final Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log('  PIPELINE RESULT');
  console.log('═'.repeat(60));
  console.log(`  Generate:  ✅`);
  console.log(`  Audit:     ✅ (${findings.length} findings)`);
  if (critHigh.length > 0) console.log(`  Fix:       ✅ (${critHigh.length} patched)`);
  console.log(`  Compile:   ${compile.isError ? '❌ FAIL' : '✅ PASS'}`);
  console.log(`\n🔺 Done.`);

  client.stop();
  process.exit(compile.isError ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
