// Pentagonal Sentinel — Pentagon Score weights (Chunk 1)
// TRANSPARENT, tunable penalty model. Score starts at `base` (100) and each factor
// subtracts a penalty. Honeypot/rug conditions hard-floor the score. Publish this file
// as the public methodology — the differentiator vs QTS's opaque score.

export const SCORE_CONFIG = {
  base: 100,
  floorOnFatal: 3, // honeypot / cannot-sell / rugged -> score is capped at this

  penalties: {
    mintable: 15,
    ownerCanModify: 15, // hidden owner / take-back / pausable / selfdestruct / balance-change
    mintAuthorityActive: 12, // Solana
    freezeAuthorityActive: 10, // Solana
    lpUnlocked: 18, // scaled by (100 - lpLockedPct) / 100
    sellTaxHigh: 12, // sellTax > 10%
    sellTaxMid: 6, // sellTax 5–10%
    concentrationHigh: 18, // top10 > 70%
    concentrationMid: 9, // top10 50–70%
    fewHolders: 12, // < 100 holders
    veryFewHolders: 18, // < 50 holders (replaces fewHolders, not additive)
    proxyMutableOwner: 6, // proxy AND owner not renounced
    rugScoreScaled: 25, // Solana: scaled by rugScore / 100
    quantumExposed: 6, // Chunk 2 hook
  },

  // Audit-finding penalties (per finding), capped so a noisy audit can't zero a clean token alone.
  audit: { critical: 18, high: 8, medium: 3, low: 1, cap: 70 },

  // Letter grade thresholds (>= score).
  grades: [
    { min: 85, grade: 'A' },
    { min: 70, grade: 'B' },
    { min: 50, grade: 'C' },
    { min: 30, grade: 'D' },
    { min: 0, grade: 'F' },
  ] as const,
};

export type ScoreConfig = typeof SCORE_CONFIG;
