import { client } from '@/lib/claude';
import { loadRules, appendRules } from '@/lib/rules';
import { DEFAULT_AGENTS } from '@/lib/types';
import { NextResponse } from 'next/server';
import { requireCredits, deductCreditForUser, refundCredit } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

// Vercel: allow up to 300s — audit pipeline runs 8 agents + 3 synthesis phases
export const maxDuration = 300;

const MAX_CODE_LENGTH = 500_000;

export async function POST(req: Request) {

  // ── Auth + Credit gate ──
  const auth = await requireCredits();
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit ──
  const limited = checkRateLimit(auth.user.id, 'paid');
  if (limited) return limited;
  let body;
  try {
    body = await req.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Invalid JSON body', detail: msg }), { status: 400 });
  }

  const { code, chain, learningOn } = body;

  if (!code || typeof code !== 'string') {
    return new Response(JSON.stringify({ error: 'code is required and must be a string' }), { status: 400 });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return new Response(JSON.stringify({ error: `code exceeds max length of ${MAX_CODE_LENGTH} characters` }), { status: 400 });
  }

  const rules = learningOn ? await loadRules() : [];
  const chainType = chain === 'solana' ? 'Solana/Anchor' : 'Solidity/EVM';

  const rulesBlock = rules.length > 0
    ? `\n\nKNOWN RULES TO CHECK:\n${rules.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  // ── Deduct credit BEFORE AI call ──
  const deduction = await deductCreditForUser(auth.user.id);
  if (!deduction.success) {
    return new Response(JSON.stringify({ error: 'Failed to deduct credit' }), { status: 402 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
      const emit = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const allFindings: { agent: string; severity: string; title: string; description: string; recommendation?: string; exploit?: string; reproductionSteps?: string[]; line: number | null }[] = [];

      // Helper to extract JSON from Claude responses (handles markdown fences)
      const extractJSON = (text: string): string => {
        // Strip markdown code fences
        const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fenceMatch) return fenceMatch[1].trim();
        // Try to find raw JSON array or object
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) return arrayMatch[0];
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) return objMatch[0];
        return text.trim();
      };

      // ─── Phase 1: Run all 8 agents IN PARALLEL ───
      // Previously sequential (~120s total) — now parallel (~15s flat)
      console.log(`[AUDIT] START — code length: ${code.length} chars, chain: ${chainType}`);
      emit({ type: 'agents-starting', count: DEFAULT_AGENTS.length });

      // Emit all agent-start events immediately so UI shows all scanning
      for (const agent of DEFAULT_AGENTS) {
        emit({ type: 'agent-start', agentId: agent.id, agentName: agent.name });
      }

      const phase1Start = Date.now();

      type Finding = {
        severity: string;
        title: string;
        description: string;
        recommendation?: string;
        exploit?: string;
        reproductionSteps?: string[];
        line?: number | null;
      };

      const agentResults = await Promise.all(
        DEFAULT_AGENTS.map(async (agent) => {
          try {
            const response = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 2048,
              system: `You are "${agent.name}", an autonomous AI security agent performing offensive penetration testing on smart contracts.
Your attack specialization: ${agent.description}
Target: ${chainType} contract.
${rulesBlock}
YOUR MISSION: Find vulnerabilities within your specialty, then PROVE each one is exploitable by writing a proof-of-concept exploit.

For each vulnerability you find, provide:
- "severity": "critical|high|medium|low"
- "title": concise vulnerability name
- "description": technical explanation of the vulnerability, how it can be exploited, and what impact it would have
- "line": the exact line number where the vulnerability exists (or null)
- "exploit": a working Solidity/JS proof-of-concept exploit code snippet that demonstrates the attack (e.g. a test function, attack contract, or script that would exploit this vulnerability). This should be code someone could actually run.
- "reproductionSteps": an array of 3-5 step-by-step strings describing how to reproduce the attack (e.g. ["1. Deploy attacker contract", "2. Call vulnerable function with crafted input", "3. Observe unauthorized state change"])
- "recommendation": specific code fix with exact changes needed

Return a JSON array. If no vulnerabilities found, return [].
Output ONLY valid JSON array, nothing else.`,
              messages: [{ role: 'user', content: `Audit this ${chainType} contract:\n\n${code}` }],
            });

            const rawText = response.content[0].type === 'text' ? response.content[0].text : '[]';

            let findings: Finding[];
            try {
              findings = JSON.parse(extractJSON(rawText));
              if (!Array.isArray(findings)) findings = [];
            } catch {
              findings = [];
            }

            const taggedFindings = findings.map((f: Finding) => ({
              ...f,
              line: f.line ?? null,
              agent: agent.id,
            }));

            return { agent, taggedFindings, success: true };
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Agent failed';
            console.error(`[AGENT ${agent.name}] ERROR:`, msg);
            return { agent, taggedFindings: [], success: false, error: msg };
          }
        })
      );

      // Emit results in order and accumulate findings
      for (const result of agentResults) {
        if (result.success) {
          allFindings.push(...result.taggedFindings);
          emit({
            type: 'agent-complete',
            agentId: result.agent.id,
            agentName: result.agent.name,
            findingCount: result.taggedFindings.length,
            findings: result.taggedFindings,
          });
        } else {
          emit({ type: 'agent-error', agentId: result.agent.id, agentName: result.agent.name, error: result.error });
        }
      }

      const phase1Elapsed = Date.now() - phase1Start;
      const successCount = agentResults.filter(r => r.success).length;
      console.log(`[AUDIT] Phase 1 done in ${phase1Elapsed}ms — ${successCount}/8 agents succeeded, ${allFindings.length} total findings`);
      if (successCount === 0) {
        console.error('[AUDIT] ALL AGENTS FAILED — check Anthropic API connectivity or model name');
        emit({ type: 'debug', message: `All agents failed (${phase1Elapsed}ms). Check server logs.` });
      }

      // ─── Phases 2 + 3 + 4: Run ALL in parallel ───
      // Previously sequential (~30s extra). Now all 3 fire at once.
      const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
      const highCount = allFindings.filter((f) => f.severity === 'high').length;
      const mediumCount = allFindings.filter((f) => f.severity === 'medium').length;
      const lowCount = allFindings.filter((f) => f.severity === 'low').length;
      let riskScore = 100 - (criticalCount * 25) - (highCount * 15) - (mediumCount * 5) - (lowCount * 2);
      riskScore = Math.max(0, Math.min(100, riskScore));

      const codePreview = code.substring(0, 3000);
      const findingsSummary = allFindings.slice(0, 8).map(f =>
        `[${f.severity.toUpperCase()}] ${f.title}${f.line ? ` (line ${f.line})` : ''}: ${f.description.substring(0, 100)}`
      ).join('\n');

      const [segResult, summaryResult, rulesResult] = await Promise.allSettled([

        // ─── Phase 2: Code Segment Analysis ───
        client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: `You analyze smart contract code and break it into logical segments for a professional audit report.
For each segment provide: "title", "startLine" (1-indexed), "endLine" (1-indexed),
"summary" (2-3 sentences), "risk" ("clean"|"informational"|"low"|"medium"|"high"|"critical").
Identify 4-8 logical segments. Output ONLY valid JSON array.`,
          messages: [{ role: 'user', content: `Break this ${chainType} contract into auditable segments:\n\n${code}` }],
        }),

        // ─── Phase 3: Executive Summary ───
        client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `You write professional smart contract security audit executive summaries.
Return JSON: { "tokenOverview": "...", "summary": "...", "methodology": "...", "recommendation": "..." }
Output ONLY valid JSON.`,
          messages: [{
            role: 'user',
            content: `Audit summary for ${chainType} contract:\nRisk: ${riskScore}/100\n${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low\n\nCODE PREVIEW:\n${codePreview}\n\nFINDINGS:\n${findingsSummary || 'None.'}`,
          }],
        }),

        // ─── Phase 4: Rule Extraction (only if learningOn) ───
        (allFindings.length > 0 && learningOn)
          ? client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 512,
              system: `Extract generalized, universal, actionable security rules (one sentence each) from audit findings.
Output ONLY a JSON array of strings.`,
              messages: [{ role: 'user', content: allFindings.map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n') }],
            })
          : Promise.resolve(null),
      ]);

      // ─── Process Phase 2 result ───
      let codeSegments: { title: string; startLine: number; endLine: number; code: string; summary: string; risk: string; findingIds: string[] }[] = [];
      if (segResult.status === 'fulfilled' && segResult.value) {
        try {
          const segRaw = segResult.value.content[0].type === 'text' ? segResult.value.content[0].text : '[]';
          const parsed = JSON.parse(extractJSON(segRaw));
          if (Array.isArray(parsed)) {
            const codeLines = code.split('\n');
            codeSegments = parsed.map((seg: { title: string; startLine: number; endLine: number; summary: string; risk: string }) => {
              const start = Math.max(0, (seg.startLine || 1) - 1);
              const end = Math.min(codeLines.length, seg.endLine || codeLines.length);
              return {
                title: seg.title,
                startLine: seg.startLine,
                endLine: seg.endLine,
                code: codeLines.slice(start, end).join('\n'),
                summary: seg.summary,
                risk: seg.risk || 'clean',
                findingIds: allFindings
                  .filter(f => f.line && f.line >= seg.startLine && f.line <= seg.endLine)
                  .map((f, i) => `${f.agent}-${i}`),
              };
            });
          }
        } catch (e) { console.error('[PHASE 2] Parse failed:', e); }
      } else if (segResult.status === 'rejected') {
        console.error('[PHASE 2] Failed:', segResult.reason);
      }

      // ─── Score Reconciliation: segments act as safety net for agent misses ───
      // Agents can miss well-known patterns (e.g. reentrancy) while the
      // independent segment analysis correctly labels them critical/high.
      // We take the CONSERVATIVE (lower) score of the two signals.
      if (codeSegments.length > 0) {
        const segCriticals = codeSegments.filter(s => s.risk === 'critical').length;
        const segHighs     = codeSegments.filter(s => s.risk === 'high').length;
        const segMediums   = codeSegments.filter(s => s.risk === 'medium').length;
        const segLows      = codeSegments.filter(s => s.risk === 'low').length;

        // Use maximum of agent vs segment count per severity tier
        const segBasedScore = Math.max(0, 100
          - (Math.max(criticalCount, segCriticals) * 25)
          - (Math.max(highCount,     segHighs)     * 15)
          - (Math.max(mediumCount,   segMediums)   * 5)
          - (Math.max(lowCount,      segLows)      * 2));

        if (segBasedScore < riskScore) {
          console.log(`[AUDIT] Score reconciled: agents said ${riskScore}/100, segments imply ${segBasedScore}/100 (${segCriticals}x critical segment) — using ${segBasedScore}`);
          riskScore = segBasedScore;
        }
      }

      // ─── Process Phase 3 result ───
      let summary = 'Audit completed.';
      let recommendation = 'Review findings and apply fixes.';
      let methodology = '';
      let tokenOverview = '';
      if (summaryResult.status === 'fulfilled' && summaryResult.value) {
        try {
          const sumRaw = summaryResult.value.content[0].type === 'text' ? summaryResult.value.content[0].text : '{}';
          const parsed = JSON.parse(extractJSON(sumRaw));
          summary = parsed.summary || summary;
          recommendation = parsed.recommendation || recommendation;
          methodology = parsed.methodology || '';
          tokenOverview = parsed.tokenOverview || '';
        } catch (e) { console.error('[PHASE 3] Parse failed:', e); }
      } else if (summaryResult.status === 'rejected') {
        console.error('[PHASE 3] Failed:', summaryResult.reason);
      }

      // ─── Process Phase 4 result ───
      if (rulesResult.status === 'fulfilled' && rulesResult.value) {
        try {
          const rulesRaw = rulesResult.value.content[0].type === 'text' ? rulesResult.value.content[0].text : '[]';
          const newRules = JSON.parse(extractJSON(rulesRaw));
          if (Array.isArray(newRules) && newRules.length > 0) {
            await appendRules(newRules);
          }
        } catch (e) { console.error('[PHASE 4] Parse failed:', e); }
      } else if (rulesResult.status === 'rejected') {
        console.error('[PHASE 4] Failed:', rulesResult.reason);
      }

      // Emit: audit complete with full report
      emit({
        type: 'audit-complete',
        report: {
          timestamp: new Date().toISOString(),
          chain: chainType,
          summary,
          tokenOverview,
          riskScore,
          findings: allFindings,
          codeSegments,
          agentResults: DEFAULT_AGENTS.map((a) => {
            const agentFindings = allFindings.filter((f) => f.agent === a.id);
            return {
              agentId: a.id,
              agentName: a.name,
              status: agentFindings.length > 0 ? 'findings' : 'clear',
              findingCount: agentFindings.length,
            };
          }),
          rulesApplied: rules.length,
          recommendation,
          methodology,
        },
      });

      controller.close();
      } catch (streamError: unknown) {
        // Refund the credit since the AI call failed
        await refundCredit(auth.user.id);
        const msg = streamError instanceof Error ? streamError.message : 'Audit failed';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`));
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
