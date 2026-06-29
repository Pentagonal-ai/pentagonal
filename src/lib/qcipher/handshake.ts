import { x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// Hybrid key agreement: classical X25519 ECDH + post-quantum ML-KEM-768. Both
// shared secrets are folded through HKDF together with the transcript, so the
// root key is safe unless BOTH primitives break. This is the standard
// concat-then-KDF hybrid combiner (X-Wing-style) composed from vetted noble
// primitives — not novel crypto. Permanent on-chain ciphertext makes the
// post-quantum half non-negotiable (harvest-now-decrypt-later is the default).

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}
export interface Identity {
  x: KeyPair;
  k: KeyPair;
}
export interface PublicBundle {
  xPub: Uint8Array;
  kPub: Uint8Array;
}
export interface HandshakeMessage {
  ephX: Uint8Array;
  kemCt: Uint8Array;
}

export function generateIdentity(): Identity {
  return { x: x25519.keygen(), k: ml_kem768.keygen() };
}

export function publicBundle(id: Identity): PublicBundle {
  return { xPub: id.x.publicKey, kPub: id.k.publicKey };
}

const ROOT_LABEL = utf8ToBytes('qcipher/v1 hybrid-root');

function combine(ecdh: Uint8Array, kem: Uint8Array, m: HandshakeMessage, b: PublicBundle): Uint8Array {
  const ikm = concatBytes(ecdh, kem);
  const info = concatBytes(ROOT_LABEL, m.ephX, b.xPub, b.kPub, m.kemCt);
  return hkdf(sha256, ikm, undefined, info, 32);
}

/** Initiator: given the recipient's public bundle, produce the handshake msg + root key. */
export function initiate(recipient: PublicBundle): { message: HandshakeMessage; rootKey: Uint8Array } {
  const eph = x25519.keygen();
  const ecdh = x25519.getSharedSecret(eph.secretKey, recipient.xPub);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipient.kPub);
  const message: HandshakeMessage = { ephX: eph.publicKey, kemCt: cipherText };
  return { message, rootKey: combine(ecdh, sharedSecret, message, recipient) };
}

/** Responder: given own identity + the handshake msg, derive the same root key. */
export function respond(self: Identity, message: HandshakeMessage): { rootKey: Uint8Array } {
  const ecdh = x25519.getSharedSecret(self.x.secretKey, message.ephX);
  const kem = ml_kem768.decapsulate(message.kemCt, self.k.secretKey);
  return { rootKey: combine(ecdh, kem, message, publicBundle(self)) };
}
