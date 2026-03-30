import { client } from '@/lib/claude';

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { prompt, chain } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return new Response(JSON.stringify({ error: 'Prompt is too short' }), { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are an expert smart contract prompt engineer for the Pentagonal platform. Your job is to take a rough user idea and expand it into a detailed, production-grade smart contract specification.

CHAIN CONTEXT: ${chain || 'Ethereum'} (${chain === 'solana' ? 'Rust/Anchor' : 'Solidity/EVM'})

When expanding a prompt:
1. Identify the core concept and add specific implementation details
2. Include relevant token standards (ERC20, ERC721, SPL, etc.)
3. Add security best practices specific to the chain
4. Specify access control patterns (Ownable, role-based, multisig)
5. Include fee/tax mechanisms if relevant
6. Add events for state changes
7. Suggest useful utility functions
8. Include chain-specific patterns (e.g. PancakeSwap for BSC, Raydium for Solana, Uniswap for ETH)

FORMAT: Return ONLY the expanded prompt as a clean paragraph/list. No code. No markdown headers. Just a well-structured contract description that can be fed directly into a contract generator. Keep it under 300 words.`,
      messages: [{
        role: 'user',
        content: `Expand this rough idea into a detailed smart contract specification:\n\n"${prompt.trim()}"`,
      }],
    });

    const expanded = response.content[0].type === 'text' ? response.content[0].text : prompt;
    return Response.json({ expanded });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Expansion failed';
    return Response.json({ error: msg }, { status: 500 });
  }
}
