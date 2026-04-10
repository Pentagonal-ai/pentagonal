import { NextRequest, NextResponse } from 'next/server';
import { streamContract } from '@/lib/claude';
import { loadRules } from '@/lib/rules';
import { requireCredits, deductCreditForUser, refundCredit, requireCreditsFromApiKey } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkX402 } from '@/lib/x402';

const MAX_PROMPT_LENGTH = 10_000;

export async function POST(req: NextRequest) {
  // ── Auth waterfall: admin key → x402 → API key → session credits ──
  const mcpKey = req.headers.get('x-pentagonal-key');
  const isMcpCall = process.env.PENTAGONAL_MCP_KEY && mcpKey === process.env.PENTAGONAL_MCP_KEY;

  let sessionUserId: string | null = null;

  if (!isMcpCall) {
    const xResult = await checkX402(req, '/api/generate');
    if (xResult.paid) {
      // x402 paid — no further auth
    } else {
      const apiKey = req.headers.get('x-pentagonal-api-key');
      if (apiKey) {
        const keyResult = await requireCreditsFromApiKey(apiKey);
        if (keyResult instanceof NextResponse) return keyResult;
        sessionUserId = keyResult.userId;
      } else {
        const auth = await requireCredits();
        if (auth instanceof NextResponse) return xResult.response;
        const limited = checkRateLimit(auth.user.id, 'paid');
        if (limited) return limited;
        sessionUserId = auth.user.id;
      }
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { prompt, chain, learningOn, solanaType } = body;

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return new Response(JSON.stringify({ error: 'prompt exceeds max length' }), { status: 400 });
  }

  // ── Deduct credit BEFORE AI call (session path only) ──
  if (sessionUserId) {
    const deduction = await deductCreditForUser(sessionUserId);
    if (!deduction.success) {
      return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 402 });
    }
  }

  const rules = learningOn ? await loadRules() : [];

  let streamError = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamContract(prompt, chain, rules, (chunk) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }, solanaType);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error) {
        streamError = true;
        // Refund the credit if AI call failed (session path only)
        if (sessionUserId) await refundCredit(sessionUserId);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
