// TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE LAUNCH
// Tests both raw fetch and SDK to isolate the connection issue
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  // ── Test 1: Raw fetch to Anthropic API ──
  let rawResult: Record<string, unknown> = {};
  const rawStart = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    rawResult = { success: true, status: res.status, elapsed_ms: Date.now() - rawStart, data };
  } catch (err) {
    rawResult = {
      success: false,
      elapsed_ms: Date.now() - rawStart,
      error: err instanceof Error ? err.message : String(err),
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    };
  }

  // ── Test 2: SDK with globalThis.fetch ──
  let sdkResult: Record<string, unknown> = {};
  const sdkStart = Date.now();
  try {
    const client = new Anthropic({ apiKey, fetch: globalThis.fetch });
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
    });
    sdkResult = {
      success: true,
      elapsed_ms: Date.now() - sdkStart,
      text: response.content[0].type === 'text' ? response.content[0].text : '',
    };
  } catch (err) {
    sdkResult = {
      success: false,
      elapsed_ms: Date.now() - sdkStart,
      error: err instanceof Error ? err.message : String(err),
      error_type: err instanceof Error ? err.constructor.name : typeof err,
    };
  }

  // ── Test 3: External HTTPS connectivity check ──
  let httpsResult: Record<string, unknown> = {};
  const httpsStart = Date.now();
  try {
    const res = await fetch('https://httpbin.org/json', { signal: AbortSignal.timeout(5000) });
    httpsResult = { success: res.ok, status: res.status, elapsed_ms: Date.now() - httpsStart };
  } catch (err) {
    httpsResult = {
      success: false,
      elapsed_ms: Date.now() - httpsStart,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return Response.json({ rawFetch: rawResult, sdkGlobalFetch: sdkResult, httpsConnectivity: httpsResult });
}
