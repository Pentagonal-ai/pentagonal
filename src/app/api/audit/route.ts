import { NextRequest, NextResponse } from 'next/server';
import { auditContract, extractRules } from '@/lib/claude';
import { loadRules, appendRules } from '@/lib/rules';
import { requireCredits, deductCreditForUser, refundCredit } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // ── Auth + Credit gate ──
  const auth = await requireCredits();
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'paid');
  if (limited) return limited;

  const { code, chain, learningOn } = await req.json();

  // ── Deduct credit BEFORE AI call ──
  const deduction = await deductCreditForUser(auth.user.id);
  if (!deduction.success) {
    return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 402 });
  }

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
    // Refund the credit since the AI call failed
    await refundCredit(auth.user.id);
    const msg = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
