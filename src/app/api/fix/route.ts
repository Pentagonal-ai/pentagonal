import { NextRequest, NextResponse } from 'next/server';
import { fixFinding } from '@/lib/claude';
import { requireCredits, requireCreditsFromApiKey } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_CODE_LENGTH = 500_000;

export async function POST(req: NextRequest) {
  // ── Auth waterfall: admin key → API key → session credits ──
  const mcpKey = req.headers.get('x-pentagonal-key');
  const isMcpCall = process.env.PENTAGONAL_MCP_KEY && mcpKey === process.env.PENTAGONAL_MCP_KEY;

  let sessionUserId: string | null = null;

  if (!isMcpCall) {
    const apiKey = req.headers.get('x-pentagonal-api-key');
    if (apiKey) {
      const keyResult = await requireCreditsFromApiKey(apiKey);
      if (keyResult instanceof NextResponse) return keyResult;
      sessionUserId = keyResult.userId;
    } else {
      const auth = await requireCredits();
      if (auth instanceof NextResponse) {
        // No session — allow as anonymous agent, rate limit by IP
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limited = checkRateLimit(ip, 'free_ai');
        if (limited) return limited;
      } else {
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, finding } = body;

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: 'code exceeds max length' }, { status: 400 });
  }
  if (!finding || !finding.title || !finding.description) {
    return NextResponse.json({ error: 'finding with title and description is required' }, { status: 400 });
  }



  try {
    // For large contracts, extract a focused window around the vulnerability
    let codeToFix = code;
    let lineOffset = 0;
    if (code.length > 50_000 && finding.line) {
      const lines = code.split('\n');
      const targetLine = finding.line;
      const windowSize = 100;
      const start = Math.max(0, targetLine - windowSize);
      const end = Math.min(lines.length, targetLine + windowSize);
      codeToFix = lines.slice(start, end).join('\n');
      lineOffset = start;
    }

    const fixedCode = await fixFinding(codeToFix, finding);
    
    // If we extracted a window, splice the fix back into the original
    if (lineOffset > 0) {
      const originalLines = code.split('\n');
      const fixedLines = fixedCode.split('\n');
      const start = lineOffset;
      const windowSize = 100;
      const end = Math.min(originalLines.length, finding.line + windowSize);
      originalLines.splice(start, end - start, ...fixedLines);
      return NextResponse.json({ code: originalLines.join('\n') });
    }

    return NextResponse.json({ code: fixedCode });
  } catch (error) {

    const msg = error instanceof Error ? error.message : 'Fix failed';
    console.error('[FIX] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
