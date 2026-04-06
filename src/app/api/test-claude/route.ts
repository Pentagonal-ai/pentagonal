// TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE LAUNCH
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, fetch: globalThis.fetch });
  
  try {
    const models = await client.models.list();
    return Response.json({
      models: models.data.map(m => ({ id: m.id, display_name: (m as Record<string, unknown>).display_name }))
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
