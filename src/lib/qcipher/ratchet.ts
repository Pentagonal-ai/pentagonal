import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

// Symmetric key ratchet. Each message derives a fresh key from the chain key,
// then the chain key advances one-way via HKDF. Stealing the live chain key
// cannot recover past message keys → forward secrecy. (Post-compromise security
// needs the DH ratchet — planned for v2.)

const L_MSG = utf8ToBytes('qcipher/v1 msg-key');
const L_CHAIN = utf8ToBytes('qcipher/v1 chain-key');

export interface Chain {
  key: Uint8Array;
  index: number;
}

export function chainFrom(seed: Uint8Array): Chain {
  return { key: seed.slice(), index: 0 };
}

/** Returns the next message key and the advanced chain (does not mutate input). */
export function step(chain: Chain): { messageKey: Uint8Array; next: Chain } {
  const messageKey = hkdf(sha256, chain.key, undefined, L_MSG, 32);
  const nextKey = hkdf(sha256, chain.key, undefined, L_CHAIN, 32);
  return { messageKey, next: { key: nextKey, index: chain.index + 1 } };
}
