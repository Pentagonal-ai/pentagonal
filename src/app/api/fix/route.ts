import { NextRequest, NextResponse } from 'next/server';
import { fixFinding } from '@/lib/claude';
import { requireCredits, deductCreditForUser, refundCredit } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_CODE_LENGTH = 500_000;

export async function POST(req: NextRequest) {
  // ── Auth + Credit gate ──
  const auth = await requireCredits('edit');
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'paid');
  if (limited) return limited;

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

  // ── Deduct credit BEFORE AI call ──
  const deduction = await deductCreditForUser(auth.user.id, 'edit');
  if (!deduction.success) {
    return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 402 });
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
    // Refund the credit since the AI call failed
    await refundCredit(auth.user.id, 'edit');
    const msg = error instanceof Error ? error.message : 'Fix failed';
    console.error('[FIX] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
