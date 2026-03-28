import { NextResponse } from 'next/server';
import { loadRules } from '@/lib/rules';

export async function GET() {
  const rules = await loadRules();
  return NextResponse.json({
    count: rules.length,
    rules,
  });
}
