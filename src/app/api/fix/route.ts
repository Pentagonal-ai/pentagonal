import { NextRequest, NextResponse } from 'next/server';
import { fixFinding } from '@/lib/claude';

const MAX_CODE_LENGTH = 100_000;

export async function POST(req: NextRequest) {
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
    const fixedCode = await fixFinding(code, finding);
    return NextResponse.json({ code: fixedCode });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Fix failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
