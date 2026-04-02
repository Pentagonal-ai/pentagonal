/**
 * Pentagonal — Auth Nonce Store
 * In-memory challenge nonce storage for wallet signature authentication.
 * 
 * On Vercel serverless: nonces are per-instance, which is acceptable since
 * challenge + verify typically hit the same instance within the 5-min TTL.
 * For multi-instance setups, migrate to Redis/KV.
 */

interface NonceData {
  createdAt: number;
  walletAddress: string;
}

const NONCE_TTL = 5 * 60_000; // 5 minutes
const nonceStore = new Map<string, NonceData>();

export function storeNonce(nonce: string, walletAddress: string): void {
  cleanupNonces();
  nonceStore.set(nonce, {
    createdAt: Date.now(),
    walletAddress: walletAddress.toLowerCase(),
  });
}

export function consumeNonce(nonce: string): { valid: boolean; walletAddress?: string } {
  cleanupNonces();
  const data = nonceStore.get(nonce);
  if (!data) return { valid: false };

  const now = Date.now();
  if (now - data.createdAt > NONCE_TTL) {
    nonceStore.delete(nonce);
    return { valid: false };
  }

  // Consume — one-time use
  nonceStore.delete(nonce);
  return { valid: true, walletAddress: data.walletAddress };
}

function cleanupNonces(): void {
  const now = Date.now();
  for (const [nonce, data] of nonceStore.entries()) {
    if (now - data.createdAt > NONCE_TTL) {
      nonceStore.delete(nonce);
    }
  }
}
