/**
 * Pentagonal — Rate Limiter
 * In-memory sliding window rate limiter.
 * No Redis needed — works well for single-instance Next.js deployments.
 */
import { NextResponse } from 'next/server';

// ─── Rate limit tiers ───
export type RateLimitTier = 'paid' | 'free_ai' | 'utility' | 'auth' | 'public';

const TIER_LIMITS: Record<RateLimitTier, { maxRequests: number; windowMs: number }> = {
  // 'paid' and 'free_ai' hit Anthropic. Their floor is whatever the upstream
  // tolerates from a single user before flagging abuse. 1–2/sec is well within.
  paid:     { maxRequests: 60,  windowMs: 60_000 },  // 60 req/min — generate, audit, fix
  free_ai:  { maxRequests: 120, windowMs: 60_000 },  // 120 req/min — explain, ask, scope

  // 'utility' hits explorers + GoPlus + DexScreener + RPCs. None of these
  // are rate-policed by us per request, so the ceiling is upstream tolerance.
  utility:  { maxRequests: 300, windowMs: 60_000 },  // 300 req/min — compile, fetch-contract, verify

  // 'auth' is the wallet-signature endpoint — keep tight to discourage
  // automated brute-force, even though signatures are unforgeable.
  auth:     { maxRequests: 5,   windowMs: 60_000 },  // 5 req/min — wallet auth (IP-keyed)

  // 'public' is anonymous fetch-contract. The old 1/min was useless for
  // legitimate visitors poking around. 60/min = 1/sec per IP — enough
  // for active manual testing, still bounded for casual abuse.
  public:   { maxRequests: 60,  windowMs: 60_000 },  // 60 req/min — anonymous token lookups
};

// ─── In-memory store ───
// Key: `${userId}:${tier}` → array of timestamps
const requestLog = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const maxWindow = Math.max(...Object.values(TIER_LIMITS).map(t => t.windowMs));
  for (const [key, timestamps] of requestLog.entries()) {
    const valid = timestamps.filter(t => now - t < maxWindow);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}

// ─── Check rate limit ───
export function checkRateLimit(
  userId: string,
  tier: RateLimitTier
): NextResponse | null {
  cleanup();

  const { maxRequests, windowMs } = TIER_LIMITS[tier];
  const key = `${userId}:${tier}`;
  const now = Date.now();

  const timestamps = requestLog.get(key) || [];
  const windowStart = now - windowMs;
  const recentRequests = timestamps.filter(t => t >= windowStart);

  if (recentRequests.length >= maxRequests) {
    const oldestInWindow = Math.min(...recentRequests);
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

    // Public tier gets a human-readable message agents can act on
    const isPublic = tier === 'public';
    const errorMessage = isPublic
      ? `Rate limited. Please wait ${retryAfter} more second${retryAfter === 1 ? '' : 's'} before trying again.`
      : 'Rate limit exceeded';

    return NextResponse.json(
      {
        error: errorMessage,
        retryAfter,
        limit: maxRequests,
        window: `${windowMs / 1000}s`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((oldestInWindow + windowMs) / 1000)),
        },
      }
    );
  }

  // Record this request
  recentRequests.push(now);
  requestLog.set(key, recentRequests);

  return null; // Not rate limited
}
