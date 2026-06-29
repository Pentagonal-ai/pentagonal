// Qcipher — quantum-safe encrypted-messaging crypto core.
// Hybrid X25519 + ML-KEM-768 handshake · per-message forward-secret ratchet ·
// chain-driven cipher rotor · length-hiding padding. Vetted @noble primitives
// only; the "rotating cipher" is orchestration, never novel crypto.
//
// See the threat model (§8) for the security requirements these modules satisfy.

export { generateIdentity, publicBundle } from './handshake.js';
export type { Identity, PublicBundle, HandshakeMessage, KeyPair } from './handshake.js';
export {
  initiatorSession,
  responderSession,
  encrypt,
  decrypt,
} from './session.js';
export type { Session, Envelope } from './session.js';
export { CIPHERS, selectCipher } from './rotor.js';
export type { CipherId } from './rotor.js';
export { identityFromSeed, IDENTITY_MESSAGE } from './identity.js';
export { serialize, deserialize } from './wire.js';
