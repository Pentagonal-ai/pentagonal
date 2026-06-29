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

// Authenticated hybrid combiner. The root key mixes three secrets:
//   es  = ECDH(initiator ephemeral, recipient static)  → forward secrecy
//   ss  = ECDH(initiator static,    recipient static)  → MUTUAL AUTHENTICATION
//   kem = ML-KEM-768 shared secret to the recipient    → post-quantum
// `ss` is the fix for the audit's HIGH: only the holder of the static secret
// behind `initiatorXPub` can produce it, so an attacker who only knows the
// (public) bundles cannot forge a message that the recipient accepts as from a
// given identity. Both parties recompute the same es/ss/kem and the same info.
function combine(
  es: Uint8Array,
  ss: Uint8Array,
  kem: Uint8Array,
  m: HandshakeMessage,
  initiatorXPub: Uint8Array,
  recipient: PublicBundle,
): Uint8Array {
  const ikm = concatBytes(es, ss, kem);
  const info = concatBytes(ROOT_LABEL, m.ephX, initiatorXPub, recipient.xPub, recipient.kPub, m.kemCt);
  return hkdf(sha256, ikm, undefined, info, 32);
}

/** Initiator: authenticate with own identity to the recipient's public bundle. */
export function initiate(self: Identity, recipient: PublicBundle): { message: HandshakeMessage; rootKey: Uint8Array } {
  const eph = x25519.keygen();
  const es = x25519.getSharedSecret(eph.secretKey, recipient.xPub);
  const ss = x25519.getSharedSecret(self.x.secretKey, recipient.xPub);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipient.kPub);
  const message: HandshakeMessage = { ephX: eph.publicKey, kemCt: cipherText };
  return { message, rootKey: combine(es, ss, sharedSecret, message, self.x.publicKey, recipient) };
}

/** Responder: derive the same root key, binding it to the *claimed* sender's
 *  static key (looked up from the registry by the conversation counterparty). A
 *  forged sender yields a different root key → decryption fails. */
export function respond(
  self: Identity,
  initiatorXPub: Uint8Array,
  message: HandshakeMessage,
): { rootKey: Uint8Array } {
  const es = x25519.getSharedSecret(self.x.secretKey, message.ephX);
  const ss = x25519.getSharedSecret(self.x.secretKey, initiatorXPub);
  const kem = ml_kem768.decapsulate(message.kemCt, self.k.secretKey);
  return { rootKey: combine(es, ss, kem, message, initiatorXPub, publicBundle(self)) };
}
