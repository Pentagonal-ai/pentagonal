// Qcipher — quantum-safe encrypted-messaging crypto core.
// Hybrid X25519 + ML-KEM-768 handshake · per-message forward-secret ratchet ·
// chain-driven cipher rotor · length-hiding padding. Vetted @noble primitives
// only; the "rotating cipher" is orchestration, never novel crypto.
//
// See the threat model (§8) for the security requirements these modules satisfy.

export { generateIdentity, publicBundle } from './handshake';
export type { Identity, PublicBundle, HandshakeMessage, KeyPair } from './handshake';
export {
  initiatorSession,
  responderSession,
  encrypt,
  decrypt,
} from './session';
export type { Session, Envelope } from './session';
export { CIPHERS, selectCipher } from './rotor';
export type { CipherId } from './rotor';
export { identityFromSeed, IDENTITY_MESSAGE } from './identity';
export { serialize, deserialize } from './wire';
export {
  deriveIdentity,
  serializeBundle,
  deserializeBundle,
  conversationId,
  toChainHex,
  fromChainHex,
} from './client';
export { QCIPHER, KEY_REGISTRY_ABI, MESSENGER_ABI } from './abi';
