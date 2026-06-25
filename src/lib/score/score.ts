// Pentagonal Sentinel — Pentagon Score (Chunk 1)
// Pure, transparent scoring: starts at 100 and subtracts documented penalties
// (see weights.ts). Returns a full factor breakdown so the score is auditable.

import { SCORE_CONFIG } from './weights';
import type { SecurityIntel } from './intel';

export type ScoreFactor = { key: string; label: string; penalty: number; detail: string };

export type AuditCounts = { critical?: number; high?: number; medium?: number; low?: number };

export type ScoreResult = {
  score: number; // 0..100, higher = safer
  grade: string; // A..F
  fatal: boolean; // honeypot / cannot-sell / rugged
  factors: ScoreFactor[]; // every penalty applied, with reasoning
  signals: SecurityIntel; // the normalized inputs (transparency)
};

export function computeScore(
  intel: SecurityIntel,
  opts: { audit?: AuditCounts; quantumExposed?: boolean } = {},
): ScoreResult {
  const P = SCORE_CONFIG.penalties;
  const factors: ScoreFactor[] = [];
  const add = (key: string, label: string, penalty: number, detail: string) => {
    if (penalty > 0) factors.push({ key, label, penalty: Math.round(penalty), detail });
  };

  const fatal = Boolean(intel.isHoneypot || intel.cannotSell || intel.rugged);
  if (fatal) {
    add('fatal', 'Fatal risk', SCORE_CONFIG.base, // recorded; floor applied below
      intel.isHoneypot ? 'Honeypot — tokens cannot be sold'
      : intel.cannotSell ? 'Sell function is disabled'
      : 'Token flagged as rugged');
  }

  if (intel.isMintable) add('mintable', 'Mintable supply', P.mintable, 'Owner can mint more tokens');
  if (intel.ownerCanModify) add('owner_modify', 'Owner can modify', P.ownerCanModify, 'Hidden owner / take-back / pausable / selfdestruct');
  if (intel.mintAuthorityActive) add('mint_authority', 'Mint authority active', P.mintAuthorityActive, 'Solana mint authority not revoked');
  if (intel.freezeAuthorityActive) add('freeze_authority', 'Freeze authority active', P.freezeAuthorityActive, 'Solana freeze authority not revoked');

  if (intel.lpLockedPct !== undefined && intel.lpLockedPct < 100) {
    const pen = (P.lpUnlocked * (100 - intel.lpLockedPct)) / 100;
    add('lp_unlocked', 'LP not fully locked', pen, `${intel.lpLockedPct.toFixed(0)}% of LP locked`);
  }

  if (intel.sellTaxPct !== undefined) {
    if (intel.sellTaxPct > 10) add('sell_tax', 'High sell tax', P.sellTaxHigh, `${intel.sellTaxPct.toFixed(1)}% sell tax`);
    else if (intel.sellTaxPct >= 5) add('sell_tax', 'Elevated sell tax', P.sellTaxMid, `${intel.sellTaxPct.toFixed(1)}% sell tax`);
  }

  if (intel.top10Pct !== undefined) {
    if (intel.top10Pct > 70) add('concentration', 'High holder concentration', P.concentrationHigh, `Top 10 hold ${intel.top10Pct.toFixed(0)}%`);
    else if (intel.top10Pct >= 50) add('concentration', 'Elevated concentration', P.concentrationMid, `Top 10 hold ${intel.top10Pct.toFixed(0)}%`);
  }

  if (intel.holderCount !== undefined) {
    if (intel.holderCount < 50) add('few_holders', 'Very few holders', P.veryFewHolders, `${intel.holderCount} holders`);
    else if (intel.holderCount < 100) add('few_holders', 'Few holders', P.fewHolders, `${intel.holderCount} holders`);
  }

  if (intel.isProxy && intel.ownerRenounced === false) {
    add('proxy', 'Upgradeable + active owner', P.proxyMutableOwner, 'Proxy contract whose owner is not renounced');
  }

  if (intel.rugScore !== undefined && intel.rugScore > 0) {
    add('rug_score', 'RugCheck risk', (P.rugScoreScaled * Math.min(intel.rugScore, 100)) / 100, `RugCheck score ${intel.rugScore}`);
  }

  if (opts.quantumExposed) add('quantum', 'Quantum-vulnerable crypto', P.quantumExposed, 'Relies on quantum-vulnerable primitives');

  if (opts.audit) {
    const a = opts.audit;
    const A = SCORE_CONFIG.audit;
    const raw = (a.critical ?? 0) * A.critical + (a.high ?? 0) * A.high + (a.medium ?? 0) * A.medium + (a.low ?? 0) * A.low;
    const pen = Math.min(raw, A.cap);
    if (pen > 0) add('audit', 'Audit findings', pen, `${a.critical ?? 0}C / ${a.high ?? 0}H / ${a.medium ?? 0}M / ${a.low ?? 0}L`);
  }

  // Sum only the non-fatal penalties; fatal is handled by the floor.
  const penaltySum = factors.filter((f) => f.key !== 'fatal').reduce((s, f) => s + f.penalty, 0);
  let score = Math.max(0, Math.min(100, SCORE_CONFIG.base - penaltySum));
  if (fatal) score = Math.min(score, SCORE_CONFIG.floorOnFatal);

  const grade = SCORE_CONFIG.grades.find((g) => score >= g.min)?.grade ?? 'F';

  return { score, grade, fatal, factors, signals: intel };
}
