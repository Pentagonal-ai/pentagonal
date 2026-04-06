import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required. Add it to .env.local');
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Force globalThis.fetch instead of SDK's bundled undici.
  // undici is incompatible with Vercel's Node.js runtime and causes APIConnectionError.
  fetch: globalThis.fetch,
});

export { client };

export type SolanaType = 'token' | 'program';

export async function streamContract(
  prompt: string,
  chain: string,
  rules: string[],
  onChunk: (chunk: string) => void,
  solanaType?: SolanaType,
): Promise<string> {
  const rulesBlock = rules.length > 0
    ? `\n\nAPPLY THESE SECURITY RULES:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  let systemPrompt: string;

  if (chain === 'solana' && solanaType === 'token') {
    // ─── Solana Token: Generate JSON config for SPL creation ───
    systemPrompt = `You are an expert Solana token architect. Generate a JSON configuration for creating an SPL token based on the user's description.

Return ONLY a valid JSON object with these fields:
{
  "name": "Token Name",
  "symbol": "SYMBOL",
  "decimals": 9,
  "initialSupply": 1000000,
  "description": "Brief description of the token's purpose",
  "mintAuthority": "wallet",
  "freezeAuthority": null,
  "metadata": {
    "uri": ""
  }
}

Rules:
- decimals should be 9 (Solana standard) unless the user specifies otherwise
- initialSupply should reflect the user's intended economics
- mintAuthority "wallet" means the deployer's connected wallet
- freezeAuthority null means no freeze authority (recommended for trust)
- Keep it simple — this is for browser-based SPL token creation
${rulesBlock}
Output ONLY the JSON object, no markdown fences, no explanation.`;
  } else if (chain === 'solana' && solanaType === 'program') {
    // ─── Solana Program: Full Anchor Rust code ───
    systemPrompt = `You are an expert Solana program developer using the Anchor framework. Generate production-quality Anchor/Rust programs.

Requirements:
- Use Anchor framework (anchor_lang::prelude::*)
- Include declare_id!("11111111111111111111111111111111") as placeholder
- Define all account structs with proper #[account] and #[derive(Accounts)]
- Use proper PDA derivation with seeds and bump
- Include comprehensive error enums with #[error_code]
- Add events with #[event] for important state changes
- Follow Solana best practices: minimize account size, use PDAs, validate all inputs
- Include NatSpec-style /// documentation on all public instructions
- Handle rent-exemption properly
${rulesBlock}
Output ONLY the Rust/Anchor code, no markdown fences, no explanation.`;
  } else {
    // ─── EVM: Solidity (default) ───
    systemPrompt = `You are an expert smart contract developer. Generate production-quality Solidity (EVM) smart contracts.
- Write clean, well-commented code following best practices
- Include all necessary imports and declarations
- Use the latest stable compiler version
- Follow OpenZeppelin patterns for EVM
- Include NatSpec documentation for all public functions
${rulesBlock}
Output ONLY the contract code, no markdown fences, no explanation.`;
  }

  let fullResponse = '';

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text);
      fullResponse += event.delta.text;
    }
  }

  return fullResponse;
}

export async function explainCode(
  code: string,
  startLine: number,
  endLine: number,
): Promise<{ title: string; explanation: string }> {
  const lines = code.split('\n').slice(startLine - 1, endLine);
  const snippet = lines.join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: 'You explain smart contract code concisely. Return JSON with "title" (max 5 words) and "explanation" (max 2 sentences). No markdown.',
    messages: [{ role: 'user', content: `Explain this code section:\n\`\`\`\n${snippet}\n\`\`\`` }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return JSON.parse(text);
  } catch {
    return { title: 'Code Section', explanation: 'This section handles contract logic.' };
  }
}

export async function auditContract(
  code: string,
  chain: string,
  rules: string[],
): Promise<string> {
  const chainType = chain === 'solana' ? 'Solana/Anchor' : 'Solidity/EVM';
  
  const rulesBlock = rules.length > 0
    ? `\n\nKNOWN RULES TO CHECK:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a team of 8 specialized smart contract security auditors performing a comprehensive pen test on a ${chainType} contract. Each auditor has a specialty:
1. Reentrancy Hunter - checks all reentrancy vectors
2. Flash Loan Attacker - checks flash loan exploits
3. Access Control Prober - checks permission issues
4. Gas Optimization - checks gas efficiency issues
5. Oracle Manipulator - checks oracle dependencies
6. Front-Running Scanner - checks MEV vulnerabilities
7. Integer Overflow Hunter - checks arithmetic issues
8. Economic Exploit Agent - checks economic attack vectors
${rulesBlock}
Return a JSON array of findings. Each finding: {"agent": "agent_id", "severity": "critical|high|medium|low", "title": "short title", "description": "explanation", "line": line_number_or_null}.
Agent IDs: reentrancy, flash-loan, access-control, gas-griefing, oracle, front-running, overflow, economic.
If no issues found by an agent, don't include entries for that agent.
Output ONLY valid JSON array, nothing else.`,
    messages: [{ role: 'user', content: `Audit this ${chainType} contract:\n\n${code}` }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '[]';
}

export async function extractRules(findings: string): Promise<string[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You extract generalized security rules from audit findings. Each rule should be universal (not specific to one contract). Return a JSON array of rule strings. Output ONLY the JSON array.`,
    messages: [{ role: 'user', content: `Extract generalized security rules from these findings:\n${findings}` }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function askAboutCode(
  code: string,
  question: string,
  context?: string,
): Promise<string> {
  const systemPrompt = context
    ? `You are a smart contract expert. The user has a question about their contract and a specific audit finding. Be concise and helpful.\n\nFinding context: ${context}`
    : 'You are a smart contract expert. Answer questions about the code concisely and helpfully.';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Contract:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}` }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : 'Unable to answer.';
}

export async function fixFinding(
  code: string,
  finding: { title: string; description: string },
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: `You are a smart contract security expert. Fix the vulnerability described below in the provided contract code.

CRITICAL RULES:
- Output ONLY the complete fixed contract code
- Do NOT wrap in markdown code fences (\`\`\`)
- Do NOT add any explanation, commentary, or notes
- Preserve all existing functionality — ONLY fix the vulnerability
- Keep all imports, interfaces, and inherited contracts intact`,
    messages: [{
      role: 'user',
      content: `Fix this vulnerability:\nTitle: ${finding.title}\nDescription: ${finding.description}\n\nContract:\n${code}`,
    }],
  });

  let result = response.content[0].type === 'text' ? response.content[0].text : code;

  // Strip markdown fences if Claude wrapped the output
  result = result.replace(/^```(?:solidity|rust|javascript|typescript|sol)?\s*\n?/i, '');
  result = result.replace(/\n?```\s*$/i, '');

  return result.trim();
}
