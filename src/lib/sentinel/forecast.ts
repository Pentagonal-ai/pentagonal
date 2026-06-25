// Pentagonal Sentinel — exploit forecasting (Chunk 7), the moat.
// Match a contract's source against accumulated exploit_signatures BEFORE an attack lands.

import type { ExploitSignature } from './signatures';

export type ForecastMatch = {
  name: string;
  severity: string;
  description: string;
  matchedOn: string; // keyword or regex that hit
};

export type ForecastResult = {
  flagged: boolean;
  imminence: 'none' | 'low' | 'medium' | 'high';
  matches: ForecastMatch[];
};

const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** Match source against signatures. Deterministic keyword/regex scan. */
export function matchSignatures(source: string, sigs: ExploitSignature[]): ForecastMatch[] {
  const src = source || '';
  const lower = src.toLowerCase();
  const out: ForecastMatch[] = [];
  for (const s of sigs) {
    let hit: string | null = null;
    for (const kw of s.pattern?.keywords ?? []) {
      if (kw && lower.includes(kw.toLowerCase())) { hit = kw; break; }
    }
    if (!hit && s.pattern?.regex) {
      try { const m = new RegExp(s.pattern.regex, 'i').exec(src); if (m) hit = m[0]; } catch { /* bad regex, skip */ }
    }
    if (hit) out.push({ name: s.name, severity: s.severity, description: s.description, matchedOn: hit });
  }
  return out;
}

export function forecast(source: string, sigs: ExploitSignature[]): ForecastResult {
  const matches = matchSignatures(source, sigs);
  if (matches.length === 0) return { flagged: false, imminence: 'none', matches: [] };
  const maxSev = Math.max(...matches.map((m) => SEV_RANK[m.severity] ?? 1));
  const imminence: ForecastResult['imminence'] =
    maxSev >= 3 || matches.length >= 3 ? 'high' : maxSev >= 2 ? 'medium' : 'low';
  return { flagged: true, imminence, matches };
}
