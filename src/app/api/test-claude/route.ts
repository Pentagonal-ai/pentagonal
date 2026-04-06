// TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE LAUNCH
// Hit /api/test-claude in your browser to see a single Claude call result
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  const start = Date.now();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: 'You are a security auditor. Return a JSON array with ONE finding for this vulnerable contract.',
      messages: [{
        role: 'user',
        content: `Audit this contract and return JSON:\n\npragma solidity ^0.8.0;\ncontract Vuln {\n  mapping(address=>uint) bal;\n  function withdraw() public {\n    (bool ok,) = msg.sender.call{value: bal[msg.sender]}("");\n    bal[msg.sender] = 0;\n  }\n}\n\nReturn: [{"severity":"critical","title":"...","description":"...","line":5}]`
      }],
    });

    const elapsed = Date.now() - start;
    const rawText = response.content[0].type === 'text' ? response.content[0].text : 'NO TEXT CONTENT';

    return Response.json({
      success: true,
      elapsed_ms: elapsed,
      model: response.model,
      stop_reason: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      raw_response: rawText,
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    return Response.json({
      success: false,
      elapsed_ms: elapsed,
      error: err instanceof Error ? err.message : String(err),
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    }, { status: 500 });
  }
}
