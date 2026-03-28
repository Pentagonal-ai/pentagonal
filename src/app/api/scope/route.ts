import { client } from '@/lib/claude';

const SYSTEM_PROMPT = `You are a smart contract requirements architect for Pentagonal, a sovereign smart contract forge.

Your job: ask questions until you know EXACTLY what to build. NEVER generate code. Only ask questions and confirm scope.

RULES:
1. Ask ONE question at a time
2. Keep questions short and clear  
3. For questions with clear choices, provide button options
4. For open-ended questions (names, numbers, descriptions), ask for typed input
5. After gathering enough information (usually 4-8 questions), present a confirmation summary
6. Always consider: token name, symbol, supply, features, access control, fees, special mechanics

RESPONSE FORMAT — you MUST respond with ONLY valid JSON, no markdown, no explanation:

For a question with button choices:
{"question": "What supply model?", "buttons": [{"label": "Fixed Supply", "value": "fixed"}, {"label": "Mintable", "value": "mintable"}, {"label": "Burn + Mint", "value": "burn_mint"}]}

For a question with multiple selectable options:
{"question": "Which features do you need?", "buttons": [...], "multiSelect": true}

For a question needing typed input:
{"question": "What should the token be called?", "inputNeeded": true}

For final scope confirmation:
{"confirmed": true, "summary": "Here's what I'll build:\\n\\n• TokenName (ERC-20) on Ethereum\\n• 1B fixed supply\\n• 2% transfer fee to treasury\\n• Owner-only admin with Pausable", "generationPrompt": "Create a Solidity ERC-20 token called TokenName with symbol TKN, 1 billion fixed supply, 2% transfer fee sent to a treasury address, Ownable access control, and Pausable functionality. Use OpenZeppelin imports."}

The generationPrompt should be a detailed, complete prompt that captures ALL decisions made during scoping. This will be sent directly to the code generator.

IMPORTANT: Always respond with ONLY the JSON object. No other text.`;

export async function POST(req: Request) {
  const { initialPrompt, history, chain } = await req.json();

  const chainType = chain === 'solana' ? 'Solana/Anchor (Rust)' : 'Solidity/EVM';

  // Build messages from history
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  } else {
    // First message — user's initial prompt
    messages.push({
      role: 'user',
      content: `I want to build a smart contract on ${chainType}. Here's my idea: ${initialPrompt}`,
    });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    // Try to parse JSON
    let parsed;
    try {
      // Sometimes Claude wraps in markdown code blocks
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, treat as a plain question
      parsed = { question: text, inputNeeded: true };
    }

    return Response.json(parsed);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Scoping failed';
    return Response.json({ error: msg }, { status: 500 });
  }
}
