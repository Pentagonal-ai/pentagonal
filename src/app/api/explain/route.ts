import { NextRequest, NextResponse } from 'next/server';
import { explainCode } from '@/lib/claude';

const MAX_CODE_LENGTH = 100_000;

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, startLine, endLine } = body;

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: 'code exceeds max length' }, { status: 400 });
  }
  if (typeof startLine !== 'number' || typeof endLine !== 'number' || startLine < 1 || endLine < startLine) {
    return NextResponse.json({ error: 'valid startLine and endLine are required' }, { status: 400 });
  }

  try {
    const result = await explainCode(code, startLine, endLine);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Explanation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
