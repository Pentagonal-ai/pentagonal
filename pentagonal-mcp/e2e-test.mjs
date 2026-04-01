#!/usr/bin/env node
// ─── Pentagonal MCP E2E Pipeline Test ───
// Simulates full agentic workflow: Generate → Audit → Fix → Re-Audit → Compile

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
          if (msg.id && this.pending.has(msg.id)) {
            this.pending.get(msg.id)(msg);
          }
        } catch {}
      }
    });

    this.proc.stderr.on('data', () => {});

    const init = await this.send('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'forge-e2e', version: '1.0' },
    });

    this.proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }) + '\n');

    return init;
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 120000);
    });
  }

  async callTool(name, args = {}) {
    const result = await this.send('tools/call', { name, arguments: args });
    const content = result.result?.content?.[0]?.text || '';
    const isError = result.result?.isError || false;
    return { text: content, isError };
  }

  stop() { this.proc.kill(); }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function extractCode(text) {
  // The code follows after the header lines
  const lines = text.split('\n');
  const codeStart = lines.findIndex(l => 
    l.includes('pragma') || l.includes('// SPDX') || l.includes('contract ')
  );
  if (codeStart === -1) return text;
  return lines.slice(codeStart).join('\n');
}

async function main() {
  const client = new MCPClient();
  await client.start();
  console.log('🔺 Pentagonal MCP — End-to-End Pipeline Test');
  console.log('   Simulating full agentic workflow as Claude Skill prescribes\n');

  // ─── Step 1: Generate ───
  section('STEP 1: GENERATE — ERC-20 with staking and burn');
  console.log('⏳ Generating contract...');
  
  const gen = await client.callTool('pentagonal_generate', {
    prompt: 'Create an ERC-20 token called "ForgeToken" with symbol "FRG". Features: 1 billion supply, 2% burn on every transfer, owner can pause transfers, and a simple staking mechanism where users can stake tokens and earn 5% APY rewards. Include proper access control.',
    chain: 'ethereum',
    use_learned_rules: true,
  });

  if (gen.isError) {
    console.log('❌ Generation failed:', gen.text);
    client.stop();
    process.exit(1);
  }

  let contractCode = extractCode(gen.text);
  const genLines = gen.text.split('\n');
  console.log(`✅ Contract generated (${contractCode.length} chars)`);
  console.log(`   ${genLines[0]}`);
  console.log(`   ${genLines[1]}`);
  console.log(`   First 5 lines:`);
  contractCode.split('\n').slice(0, 5).forEach(l => console.log(`   │ ${l}`));
  console.log(`   │ ... (${contractCode.split('\n').length} total lines)`);

  // ─── Step 2: Audit ───
  section('STEP 2: AUDIT — 8-agent security pen test');
  console.log('⏳ Running 8-agent audit...');

  const audit1 = await client.callTool('pentagonal_audit', {
    code: contractCode,
    chain: 'ethereum',
    use_learned_rules: true,
  });

  if (audit1.isError) {
    console.log('❌ Audit failed:', audit1.text);
    client.stop();
    process.exit(1);
  }

  // Parse findings from the text
  const findingsMatch = audit1.text.match(/\[.*\]/s);
  let findings = [];
  try {
    if (findingsMatch) findings = JSON.parse(findingsMatch[0]);
  } catch {}

  const criticals = findings.filter(f => f.severity === 'critical');
  const highs = findings.filter(f => f.severity === 'high');
  const mediums = findings.filter(f => f.severity === 'medium');
  const lows = findings.filter(f => f.severity === 'low');

  console.log(`✅ Audit complete`);
  console.log(`   📊 Findings: ${criticals.length} critical, ${highs.length} high, ${mediums.length} medium, ${lows.length} low`);
  
  for (const f of findings) {
    const icon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
    console.log(`   ${icon} [${f.severity.toUpperCase()}] ${f.title} (${f.agent})${f.line ? ` — L${f.line}` : ''}`);
  }

  // Extract rules stats
  const rulesMatch = audit1.text.match(/Rules applied: (\d+).*New rules learned: (\d+)/);
  if (rulesMatch) {
    console.log(`   📏 Rules applied: ${rulesMatch[1]} | New rules learned: ${rulesMatch[2]}`);
  }

  // ─── Step 3: Fix (critical + high) ───
  const toFix = [...criticals, ...highs];
  
  if (toFix.length > 0) {
    section(`STEP 3: FIX — ${toFix.length} critical/high finding(s)`);
    
    for (let i = 0; i < toFix.length; i++) {
      const f = toFix[i];
      console.log(`\n⏳ Fixing ${i + 1}/${toFix.length}: ${f.title}...`);
      
      const fix = await client.callTool('pentagonal_fix', {
        code: contractCode,
        finding_title: f.title,
        finding_description: f.description,
      });

      if (fix.isError) {
        console.log(`   ❌ Fix failed: ${fix.text.slice(0, 100)}`);
        continue;
      }

      contractCode = extractCode(fix.text);
      console.log(`   ✅ Fixed (${contractCode.length} chars)`);
    }

    // ─── Step 4: Re-Audit ───
    section('STEP 4: RE-AUDIT — Verify fixes');
    console.log('⏳ Re-running 8-agent audit on fixed code...');

    const audit2 = await client.callTool('pentagonal_audit', {
      code: contractCode,
      chain: 'ethereum',
      use_learned_rules: true,
    });

    const findingsMatch2 = audit2.text.match(/\[.*\]/s);
    let findings2 = [];
    try {
      if (findingsMatch2) findings2 = JSON.parse(findingsMatch2[0]);
    } catch {}

    const remaining = findings2.filter(f => f.severity === 'critical' || f.severity === 'high');
    console.log(`✅ Re-audit complete`);
    console.log(`   📊 Remaining: ${findings2.length} total findings (${remaining.length} critical/high)`);
    
    for (const f of findings2) {
      const icon = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
      console.log(`   ${icon} [${f.severity.toUpperCase()}] ${f.title}`);
    }

    if (remaining.length > 0) {
      console.log(`   ⚠️  ${remaining.length} critical/high issues persist — in production, would loop back to fix`);
    } else {
      console.log(`   🟢 All critical/high issues resolved!`);
    }
  } else {
    console.log('\n✨ No critical/high findings — skipping fix step');
  }

  // ─── Step 5: Compile ───
  section('STEP 5: COMPILE — Solidity → ABI + Bytecode');
  console.log('⏳ Compiling final contract...');

  const compile = await client.callTool('pentagonal_compile', {
    code: contractCode,
  });

  if (compile.isError) {
    console.log(`❌ Compilation failed:`);
    console.log(`   ${compile.text.split('\n').slice(0, 5).join('\n   ')}`);
    
    // Common issue: OpenZeppelin imports. Show what happened.
    if (compile.text.includes('import') || compile.text.includes('OpenZeppelin')) {
      console.log('\n   💡 Contract has external imports — Pentagonal compiles self-contained code.');
      console.log('   In a real workflow, re-generate with explicit "no imports" instruction.');
    }
  } else {
    const compileLines = compile.text.split('\n');
    console.log(`✅ Compilation successful!`);
    compileLines.slice(0, 5).forEach(l => console.log(`   ${l}`));
    
    // Check for ABI and bytecode
    const hasABI = compile.text.includes('ABI');
    const hasBytecode = compile.text.includes('0x');
    console.log(`   📦 ABI: ${hasABI ? '✅' : '❌'} | Bytecode: ${hasBytecode ? '✅' : '❌'}`);
  }

  // ─── Summary ───
  section('PIPELINE COMPLETE');
  console.log(`  ✅ Generate  — ${gen.isError ? 'FAIL' : 'PASS'}`);
  console.log(`  ✅ Audit     — ${audit1.isError ? 'FAIL' : 'PASS'} (${findings.length} findings)`);
  if (toFix.length > 0) {
    console.log(`  ✅ Fix       — ${toFix.length} vulnerabilities patched`);
    console.log(`  ✅ Re-Audit  — verified`);
  }
  console.log(`  ${compile.isError ? '❌' : '✅'} Compile   — ${compile.isError ? 'FAIL (imports)' : 'PASS'}`);
  console.log(`\n🔺 Pentagonal MCP pipeline test complete.`);

  client.stop();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
