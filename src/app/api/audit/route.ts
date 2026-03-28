import { NextRequest, NextResponse } from 'next/server';
import { auditContract, extractRules } from '@/lib/claude';
import { loadRules, appendRules } from '@/lib/rules';

export async function POST(req: NextRequest) {
  const { code, chain, learningOn } = await req.json();

  try {
    const rules = learningOn ? await loadRules() : [];
    const resultJson = await auditContract(code, chain, rules);

    let findings;
    try {
      findings = JSON.parse(resultJson);
    } catch {
      findings = [];
    }

    // Extract and save new rules from findings (always learn, regardless of toggle)
    if (findings.length > 0) {
      try {
        const newRules = await extractRules(resultJson);
        if (newRules.length > 0) {
          await appendRules(newRules);
        }
      } catch {
        // Rule extraction failure shouldn't block the audit response
      }
    }

    return NextResponse.json({ findings });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
