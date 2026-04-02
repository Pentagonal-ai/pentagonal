import { NextRequest, NextResponse } from 'next/server';
import { askAboutCode } from '@/lib/claude';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_CODE_LENGTH = 100_000;
const MAX_QUESTION_LENGTH = 2_000;

export async function POST(req: NextRequest) {
  // ── Auth gate ──
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'free_ai');
  if (limited) return limited;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, question, context } = body;

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: 'code exceeds max length' }, { status: 400 });
  }
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: 'question exceeds max length' }, { status: 400 });
  }

  try {
    const answer = await askAboutCode(code, question, context);
    return NextResponse.json({ answer });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to answer';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
