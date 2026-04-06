// TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE LAUNCH
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey, fetch: globalThis.fetch });

  // Test the exact model used in production audit
  const modelsToTest = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ];

  const results: Record<string, unknown> = {};
  
  for (const model of modelsToTest) {
    const start = Date.now();
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with: OK' }],
      });
      results[model] = {
        success: true,
        elapsed_ms: Date.now() - start,
        response: res.content[0].type === 'text' ? res.content[0].text : '',
      };
      break; // Stop at first working model
    } catch (err) {
      results[model] = {
        success: false,
        elapsed_ms: Date.now() - start,
        error: err instanceof Error ? err.message.slice(0, 150) : String(err),
      };
    }
  }

  return Response.json(results);
}
