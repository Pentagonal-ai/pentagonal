#!/usr/bin/env node
// ─── Pentagonal MCP Server ───
// Smart Contract Forge for AI models
// Generate, audit, fix, and compile smart contracts via MCP tools
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateContract } from './forge.js';
import { auditContract } from './forge.js';
import { fixVulnerability } from './forge.js';
import { compileSolidity } from './compiler.js';
import { loadRules } from './rules.js';
import { CHAINS } from './chains.js';
import { lookupToken } from './intel.js';
// ─── Server Setup ───
const server = new McpServer({
    name: 'pentagonal',
    version: '1.0.0',
});
// ─── Tool: Generate Contract ───
server.tool('pentagonal_generate', 'Generate a production-quality smart contract from a natural language description. Supports EVM (Solidity) and Solana (Anchor/Rust or SPL Token config). The generator uses Pentagonal\'s self-learning security rules to produce safer code.', {
    prompt: z.string().describe('Natural language description of the smart contract to generate. Be specific about features, access control, and tokenomics.'),
    chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum').describe('Target blockchain'),
    solana_type: z.enum(['program', 'token']).optional().describe('For Solana only: "program" for Anchor/Rust programs, "token" for SPL token JSON config'),
    use_learned_rules: z.boolean().default(true).describe('Inject self-learning security rules into generation prompt'),
}, async ({ prompt, chain, solana_type, use_learned_rules }) => {
    try {
        const result = await generateContract(prompt, chain, use_learned_rules, solana_type);
        return {
            content: [{
                    type: 'text',
                    text: `✅ Contract generated for ${chain}\n📏 Rules applied: ${result.rulesApplied}\n\n${result.code}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `❌ Generation failed: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
});
// ─── Tool: Lookup Token ───
server.tool('pentagonal_lookup', 'Look up any token or smart contract by address. Returns the full intelligence report: price, market cap, ATH, 24h volume, transactions, holders, liquidity, LP lock status, pool count, security flags (honeypot, mintable, pausable, hidden owner, taxes), social links, and source code if verified. Use this before auditing to understand the full token landscape. Supports EVM and Solana tokens.', {
    address: z.string().describe('Contract address. EVM: 0x... checksum or lowercase. Solana: base58 program address.'),
    chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum').describe('Target blockchain'),
    fields: z.array(z.enum(['price', 'market', 'liquidity', 'holders', 'security', 'socials', 'code', 'all'])).default(['all']).describe('Which data sections to return. "all" returns everything. Use specific fields for faster, focused queries — e.g. ["security"] for just flags, ["price", "market"] for market data, ["code"] for source only.'),
}, async ({ address, chain, fields }) => {
    try {
        const { report } = await lookupToken(address, chain, fields);
        return {
            content: [{ type: 'text', text: report }],
        };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: `❌ Lookup failed: ${msg}` }],
            isError: true,
        };
    }
});
// ─── Tool: Audit Contract ───
server.tool('pentagonal_audit', 'Run an 8-agent security pen test on a smart contract. Each agent specializes in a different attack vector: reentrancy, flash loans, access control, gas griefing, oracle manipulation, front-running, integer overflow, and economic exploits. Findings are returned with severity ratings and line numbers. New security rules are automatically learned from each audit.', {
    code: z.string().describe('The full smart contract source code to audit'),
    chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'avalanche', 'solana']).default('ethereum').describe('Which blockchain the contract targets'),
    use_learned_rules: z.boolean().default(true).describe('Use previously learned security rules during the audit'),
}, async ({ code, chain, use_learned_rules }) => {
    try {
        const result = await auditContract(code, chain, use_learned_rules);
        const summary = result.findings.length === 0
            ? '✅ No vulnerabilities found!'
            : `⚠️ Found ${result.findings.length} issue(s):\n` +
                result.findings.map(f => `  [${f.severity.toUpperCase()}] ${f.title} (${f.agent})${f.line ? ` — Line ${f.line}` : ''}\n    ${f.description}`).join('\n');
        const footer = `\n\n📏 Rules applied: ${result.rulesApplied} | 📚 New rules learned: ${result.newRulesLearned}`;
        return {
            content: [{
                    type: 'text',
                    text: summary + footer + '\n\n' + JSON.stringify(result.findings, null, 2),
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `❌ Audit failed: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
});
// ─── Tool: Fix Vulnerability ───
server.tool('pentagonal_fix', 'Fix a specific vulnerability in a smart contract. Provide the contract code and the finding details — returns the complete fixed contract preserving all existing functionality.', {
    code: z.string().describe('The full smart contract source code to fix'),
    finding_title: z.string().describe('Short title of the vulnerability (e.g., "Reentrancy in withdraw()")'),
    finding_description: z.string().describe('Detailed description of the vulnerability and how it can be exploited'),
}, async ({ code, finding_title, finding_description }) => {
    try {
        const fixedCode = await fixVulnerability(code, finding_title, finding_description);
        return {
            content: [{
                    type: 'text',
                    text: `✅ Vulnerability fixed: ${finding_title}\n\n${fixedCode}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `❌ Fix failed: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
});
// ─── Tool: Compile Solidity ───
server.tool('pentagonal_compile', 'Compile Solidity source code and return the ABI, bytecode, constructor arguments, and gas estimates. Use this after generating and auditing a contract to prepare it for deployment.', {
    code: z.string().describe('Solidity source code to compile'),
    contract_name: z.string().optional().describe('Specific contract name to compile (auto-detected if omitted)'),
}, async ({ code, contract_name }) => {
    try {
        const result = compileSolidity(code, contract_name);
        if (!result.success) {
            const errMsg = result.errors?.map(e => e.message).join('\n') || 'Compilation failed';
            return {
                content: [{ type: 'text', text: `❌ Compilation failed:\n${errMsg}` }],
                isError: true,
            };
        }
        const output = [
            `✅ Compiled: ${result.contractName}`,
            `📦 Bytecode size: ${result.bytecode?.length ?? 0} chars`,
            `🔧 Constructor args: ${result.constructorArgs?.length ? result.constructorArgs.map(a => `${a.name}: ${a.type}`).join(', ') : 'none'}`,
            result.gasEstimates ? `⛽ Gas estimate: ${result.gasEstimates.total ?? 'unknown'}` : '',
            result.warnings?.length ? `⚠️ Warnings:\n${result.warnings.map(w => `  ${w.message}`).join('\n')}` : '',
            `\n--- ABI ---\n${JSON.stringify(result.abi, null, 2)}`,
            `\n--- Bytecode ---\n${result.bytecode}`,
        ].filter(Boolean).join('\n');
        return {
            content: [{ type: 'text', text: output }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `❌ Compilation error: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
});
// ─── Tool: Get Rules ───
server.tool('pentagonal_rules', 'Get the current self-learning security rules. These rules are accumulated from every audit Pentagonal performs — the more contracts audited, the smarter the system gets.', {}, async () => {
    try {
        const rules = await loadRules();
        const count = rules.length;
        return {
            content: [{
                    type: 'text',
                    text: count === 0
                        ? '📚 No rules learned yet. Run some audits to start building the knowledge base.'
                        : `📚 ${count} learned security rules:\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `❌ Failed to load rules: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true,
        };
    }
});
// ─── Tool: List Chains ───
server.tool('pentagonal_chains', 'List all supported blockchains with their chain IDs, explorer URLs, and deployment hints.', {}, async () => {
    const chainList = CHAINS.map(c => `${c.icon} ${c.name} (${c.id}) — ${c.type.toUpperCase()}` +
        (c.chainId ? ` | Chain ID: ${c.chainId}` : '') +
        (c.testnetChainId ? ` | Testnet: ${c.testnetChainId}` : '') +
        ` | Explorer: ${c.explorerUrl}` +
        (c.rpcHint ? ` | 💡 ${c.rpcHint}` : '')).join('\n');
    return {
        content: [{
                type: 'text',
                text: `🔗 Supported chains:\n\n${chainList}`,
            }],
    };
});
// ─── Start Server ───
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🔺 Pentagonal MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map