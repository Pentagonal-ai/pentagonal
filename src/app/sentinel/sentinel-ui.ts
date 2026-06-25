// Shared UI helpers for the Sentinel dashboard.

export type Grade = 'a' | 'b' | 'c' | 'd' | 'f';

export const CHAINS = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'solana'] as const;
export type Chain = (typeof CHAINS)[number];

export function grade(score: number): Grade {
  return score >= 85 ? 'a' : score >= 70 ? 'b' : score >= 50 ? 'c' : score >= 30 ? 'd' : 'f';
}

export function ringColor(g: Grade): string {
  return ({ a: 'var(--sn-green)', b: '#a8d8a0', c: 'var(--sn-yellow)', d: '#d98a3a', f: 'var(--sn-red)' } as const)[g];
}

export function gradeLabel(g: Grade): string {
  return ({ a: 'low risk', b: 'medium risk', c: 'elevated risk', d: 'high risk', f: 'critical' } as const)[g];
}

export function initial(s: string): string {
  return (s || '?').trim().charAt(0).toUpperCase();
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
