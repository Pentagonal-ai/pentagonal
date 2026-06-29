import { x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import type { Identity } from './handshake.js';

// The user's wallet IS their Qcipher identity. They sign one fixed message; that
// signature is fed here and deterministically derives the X25519 + ML-KEM
// identity — re-derivable on any device, no key storage or sync. The signature
// seed never leaves the client and never touches the network.

export const IDENTITY_MESSAGE =
  'Qcipher: derive my end-to-end encryption identity.\n' +
  'This signature stays on your device — only sign it on qcipher.';

/** Deterministically derive a hybrid identity from a wallet signature (or any seed). */
export function identityFromSeed(signatureSeed: Uint8Array): Identity {
  // Expand the signature into independent seeds: 32 bytes (x25519) + 64 bytes (ML-KEM).
  const material = hkdf(sha256, signatureSeed, undefined, utf8ToBytes('qcipher/v1 identity'), 32 + 64);
  return {
    x: x25519.keygen(material.slice(0, 32)),
    k: ml_kem768.keygen(material.slice(32, 96)),
  };
}
