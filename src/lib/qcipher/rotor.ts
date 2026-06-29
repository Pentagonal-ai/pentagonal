import { gcm } from '@noble/ciphers/aes.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';

// The visible "rotor": the AEAD suite rotates per epoch. v1 ships two vetted
// AEADs; a post-quantum AEAD joins the set later. Each is independently strong,
// so the rotation is crypto-agility + defense-in-depth, not a strength multiplier.
//
// SECURITY: the authoritative cipher id is stamped in the AEAD-authenticated
// header (see session.ts) and never re-derived by the receiver. selectCipher()
// only picks the sender-side default, driven by the chain — so the rotation is
// visible and auditable without risking a sender/receiver desync.

export const CIPHERS = ['aes-256-gcm', 'chacha20-poly1305'] as const;
export type CipherId = (typeof CIPHERS)[number];

/** Chain-driven default cipher for an epoch. Deterministic, visible, and
 *  uniformly distributed regardless of how epoch/blockHash correlate. */
export function selectCipher(epoch: number, blockHash: Uint8Array): CipherId {
  const ep = new Uint8Array(4);
  new DataView(ep.buffer).setUint32(0, epoch >>> 0, false);
  const h = sha256(concatBytes(ep, blockHash));
  return CIPHERS[h[0] % CIPHERS.length];
}

function aead(id: CipherId, key: Uint8Array, nonce: Uint8Array, aad: Uint8Array) {
  switch (id) {
    case 'aes-256-gcm':
      return gcm(key, nonce, aad);
    case 'chacha20-poly1305':
      return chacha20poly1305(key, nonce, aad);
    default:
      throw new Error(`qcipher: unknown cipher id "${id as string}"`);
  }
}

export function seal(
  id: CipherId,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  return aead(id, key, nonce, aad).encrypt(plaintext);
}

export function open(
  id: CipherId,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  return aead(id, key, nonce, aad).decrypt(ciphertext);
}
