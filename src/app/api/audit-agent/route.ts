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
              model: 'claude-sonnet-4-20250514',
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

      // ─── Phase 2: Code Segment Analysis ───
      let codeSegments: { title: string; startLine: number; endLine: number; code: string; summary: string; risk: string; findingIds: string[] }[] = [];

      try {
        const segmentResponse = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: `You analyze smart contract code and break it into logical segments for a professional audit report.
For each segment, provide:
- "title": descriptive name (e.g. "Token Transfer Logic", "Access Control Modifiers", "Constructor & Initialization")
- "startLine": first line number (1-indexed)
- "endLine": last line number (1-indexed)
- "summary": 2-3 sentence technical analysis of what this segment does, its purpose, and any patterns used
- "risk": "clean" | "informational" | "low" | "medium" | "high" | "critical" — the highest risk level in this segment

Return a JSON array of segments ordered by line number.
Identify 4-8 logical segments covering the full contract.
Output ONLY valid JSON array.`,
          messages: [{
            role: 'user',
            content: `Break this ${chainType} contract into auditable segments:\n\n${code}`,
          }],
        });

        const segRawText = segmentResponse.content[0].type === 'text' ? segmentResponse.content[0].text : '[]';
        // debug: console.log(`[PHASE 2] Segment raw (first 200): ${segRawText.substring(0, 200)}`);
        const segText = extractJSON(segRawText);
        try {
          const parsed = JSON.parse(segText);
          if (Array.isArray(parsed)) {
            const codeLines = code.split('\n');
            codeSegments = parsed.map((seg: { title: string; startLine: number; endLine: number; summary: string; risk: string }) => {
              const start = Math.max(0, (seg.startLine || 1) - 1);
              const end = Math.min(codeLines.length, seg.endLine || codeLines.length);
              const segCode = codeLines.slice(start, end).join('\n');

              // Match findings to this segment by line number
              const segFindings = allFindings
                .filter(f => f.line && f.line >= seg.startLine && f.line <= seg.endLine)
                .map((f, i) => `${f.agent}-${i}`);

              return {
                title: seg.title,
                startLine: seg.startLine,
                endLine: seg.endLine,
                code: segCode,
                summary: seg.summary,
                risk: seg.risk || 'clean',
                findingIds: segFindings,
              };
            });
          }
        } catch (parseErr) { console.error('[PHASE 2] Segment JSON parse failed:', parseErr); }
      } catch (segErr) { console.error('[PHASE 2] Segment analysis failed:', segErr instanceof Error ? segErr.message : segErr); }

      // ─── Phase 3: Generate comprehensive report ───
      const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
      const highCount = allFindings.filter((f) => f.severity === 'high').length;
      const mediumCount = allFindings.filter((f) => f.severity === 'medium').length;
      const lowCount = allFindings.filter((f) => f.severity === 'low').length;

      let riskScore = 100 - (criticalCount * 25) - (highCount * 15) - (mediumCount * 5) - (lowCount * 2);
      riskScore = Math.max(0, Math.min(100, riskScore));

      let summary = 'Audit completed.';
      let recommendation = 'Review findings and apply fixes.';
      let methodology = '';
      let tokenOverview = '';

      try {
        // Include first 3000 chars of contract for token analysis
        const codePreview = code.substring(0, 3000);
        const findingsSummary = allFindings.slice(0, 8).map(f => `[${f.severity.toUpperCase()}] ${f.title}${f.line ? ` (line ${f.line})` : ''}: ${f.description.substring(0, 100)}`).join('\n');

        const summaryResponse = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: `You write professional smart contract security audit executive summaries. You must analyze the contract code to understand what the token/contract does, then summarize both the token AND the audit findings.

Return JSON with these fields:
{
  "tokenOverview": "2-3 sentence description of what this contract IS — its name, purpose, token type (ERC20, ERC721, etc.), key features (fees, reflections, liquidity locks, etc.), and notable mechanisms. Write as if explaining to a developer what this contract does.",
  "summary": "4-6 sentence executive summary covering: (1) what was audited, (2) the scope of the analysis, (3) key risk areas identified, (4) overall security posture. Reference specific findings by name.",
  "methodology": "2-3 sentence description of the audit methodology — 8 specialized AI agents each targeting a different attack surface (reentrancy, flash loans, access control, gas optimization, oracle manipulation, front-running, integer overflow, economic exploits). Each agent generates proof-of-concept exploits to validate findings.",
  "recommendation": "2-3 sentence actionable recommendation for the development team, referencing the most critical findings."
}
Output ONLY valid JSON.`,
          messages: [{
            role: 'user',
            content: `Analyze this ${chainType} contract and summarize the audit:

CONTRACT CODE (preview):
${codePreview}

AUDIT RESULTS:
- Risk score: ${riskScore}/100
- ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low findings
- ${rules.length} learned security rules applied
- 8 specialized agents completed their scans
- ${codeSegments.length} code segments analyzed

FINDINGS DETAIL:
${findingsSummary || 'No vulnerabilities identified.'}`,
          }],
        });

        const summaryRaw = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '{}';
        // debug: console.log(`[PHASE 3] Summary raw (first 300): ${summaryRaw.substring(0, 300)}`);
        
        try {
          const parsed = JSON.parse(extractJSON(summaryRaw));
          summary = parsed.summary || summary;
          recommendation = parsed.recommendation || recommendation;
          methodology = parsed.methodology || '';
          tokenOverview = parsed.tokenOverview || '';
        } catch (parseErr) { console.error('[PHASE 3] Summary JSON parse failed:', parseErr); }
      } catch (sumErr) { console.error('[PHASE 3] Summary generation failed:', sumErr instanceof Error ? sumErr.message : sumErr); }

      // ─── Phase 4: Extract rules from findings (feedback loop) ───
      if (allFindings.length > 0 && learningOn) {
        try {
          const findingsSummaryForRules = allFindings.map(f => 
            `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`
          ).join('\n');

          const rulesResponse = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: `You extract generalized, universal security rules from smart contract audit findings.
Each rule must be:
- Universal (not specific to one contract name or address)
- Actionable (tells a developer what to do or avoid)
- Concise (one sentence per rule)

Return a JSON array of rule strings. Example:
["Always use ReentrancyGuard on functions that make external calls before updating state",
 "Validate all user-supplied array lengths to prevent gas griefing attacks"]
Output ONLY the JSON array.`,
            messages: [{ role: 'user', content: `Extract generalized security rules from these audit findings:\n${findingsSummaryForRules}` }],
          });

          const rulesText = rulesResponse.content[0].type === 'text' ? rulesResponse.content[0].text : '[]';
          // debug: console.log(`[PHASE 4] Rules extraction raw (first 200): ${rulesText.substring(0, 200)}`);
          
          const newRules = JSON.parse(extractJSON(rulesText));
          if (Array.isArray(newRules) && newRules.length > 0) {
            await appendRules(newRules);
            // debug: console.log(`[PHASE 4] Appended ${newRules.length} new rules to pentagonal-rules.md`);
          }
        } catch (ruleErr) {
          console.error('[PHASE 4] Rule extraction failed:', ruleErr instanceof Error ? ruleErr.message : ruleErr);
        }
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
