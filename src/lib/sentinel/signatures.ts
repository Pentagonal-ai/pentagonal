// Pentagonal Sentinel — adaptive signatures (Chunk 5)
// DB-backed (exploit_signatures) so it persists on serverless, unlike the file-based
// generation rules. Baseline seeds + learning from audit findings feed Chunk 7 forecasting.

import { createClient } from '@supabase/supabase-js';

export type ExploitSignature = {
  id?: string;
  name: string;
  description: string;
  pattern: { keywords?: string[]; regex?: string };
  severity: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
};

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// High-precision starter set so forecasting is meaningful from day one.
export const BASELINE: ExploitSignature[] = [
  { name: 'tx.origin authentication', description: 'Uses tx.origin for authorization — vulnerable to phishing / relay attacks.', pattern: { keywords: ['tx.origin'] }, severity: 'high', source: 'baseline' },
  { name: 'Unprotected selfdestruct', description: 'Contains selfdestruct — destroyable if access control is weak.', pattern: { keywords: ['selfdestruct('] }, severity: 'high', source: 'baseline' },
  { name: 'delegatecall execution surface', description: 'Uses delegatecall — arbitrary code execution if the target is influenced by input.', pattern: { keywords: ['delegatecall('] }, severity: 'high', source: 'baseline' },
  { name: 'abi.encodePacked hash collision', description: 'encodePacked with dynamic types can collide in signature/commitment schemes.', pattern: { keywords: ['encodepacked('] }, severity: 'medium', source: 'baseline' },
  { name: 'Low-level value call', description: 'Low-level .call{value:} to a variable address — reentrancy / arbitrary-call surface.', pattern: { regex: '\\.call\\s*\\{\\s*value' }, severity: 'medium', source: 'baseline' },
];

export async function getSignatures(): Promise<ExploitSignature[]> {
  const { data } = await admin().from('exploit_signatures').select('id,name,description,pattern,severity,source');
  return (data ?? []) as ExploitSignature[];
}

async function existingNames(): Promise<Set<string>> {
  const { data } = await admin().from('exploit_signatures').select('name');
  return new Set((data ?? []).map((r: { name: string }) => r.name.toLowerCase()));
}

/** Insert signatures that don't already exist (dedup by name). Returns count added. */
export async function insertSignatures(sigs: ExploitSignature[]): Promise<number> {
  if (!sigs.length) return 0;
  const have = await existingNames();
  const fresh = sigs.filter((s) => !have.has(s.name.toLowerCase()));
  if (!fresh.length) return 0;
  const { error } = await admin().from('exploit_signatures').insert(
    fresh.map((s) => ({ name: s.name, description: s.description, pattern: s.pattern, severity: s.severity, source: s.source ?? 'learned' })),
  );
  if (error) { console.error('[signatures] insert:', error.message); return 0; }
  return fresh.length;
}

export async function seedBaseline(): Promise<number> {
  return insertSignatures(BASELINE);
}

/** Learn signatures from audit findings (critical/high only). */
export async function recordSignatures(
  findings: { title?: string; severity?: string; description?: string }[],
  source = 'audit',
): Promise<number> {
  const sigs: ExploitSignature[] = [];
  for (const f of findings) {
    const sev = (f.severity ?? '').toLowerCase();
    if (sev !== 'critical' && sev !== 'high') continue;
    const title = (f.title ?? '').trim();
    if (!title) continue;
    const keywords = [...new Set(title.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length > 3))].slice(0, 6);
    sigs.push({ name: title.slice(0, 120), description: (f.description ?? title).slice(0, 400), pattern: { keywords }, severity: sev as 'high' | 'critical', source });
  }
  return insertSignatures(sigs);
}
