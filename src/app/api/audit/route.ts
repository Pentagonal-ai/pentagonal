import { NextRequest, NextResponse } from 'next/server';
import { auditContract, extractRules } from '@/lib/claude';
import { loadRules, appendRules } from '@/lib/rules';
import { requireAuth, chargeForAction, refundAction } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // ── Auth (no hard credit gate — token holders may have 0 credits but a free one) ──
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'paid');
  if (limited) return limited;

  const { code, chain, learningOn } = await req.json();

  // ── Charge: daily free credit (token holders) OR paid credit ──
  const charge = await chargeForAction(auth.user);
  if (charge instanceof NextResponse) return charge;

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

    return NextResponse.json({ findings, paidWith: charge.method });
  } catch (error) {
    // Refund (free claim or paid credit) since the AI call failed
    await refundAction(auth.user.id, charge.method);
    const msg = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
