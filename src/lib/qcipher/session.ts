import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { chainFrom, step, type Chain } from './ratchet';
import { selectCipher, seal, open, CIPHERS, type CipherId } from './rotor';
import { pad, unpad } from './padding';
import {
  initiate,
  respond,
  type Identity,
  type PublicBundle,
  type HandshakeMessage,
} from './handshake';

// A session holds two directional chains seeded from the root key, so each
// direction ratchets independently (its own forward secrecy). The initiator
// sends on chain A / receives on B; the responder mirrors.

function directionalChains(rootKey: Uint8Array) {
  return {
    a: hkdf(sha256, rootKey, undefined, utf8ToBytes('qcipher/v1 chain-A'), 32),
    b: hkdf(sha256, rootKey, undefined, utf8ToBytes('qcipher/v1 chain-B'), 32),
  };
}

export interface Session {
  send: Chain;
  recv: Chain;
}

export function initiatorSession(
  self: Identity,
  recipient: PublicBundle,
): { session: Session; handshake: HandshakeMessage } {
  const { message, rootKey } = initiate(self, recipient);
  const c = directionalChains(rootKey);
  return { session: { send: chainFrom(c.a), recv: chainFrom(c.b) }, handshake: message };
}

export function responderSession(
  self: Identity,
  initiator: PublicBundle,
  handshake: HandshakeMessage,
): Session {
  const { rootKey } = respond(self, initiator.xPub, handshake);
  const c = directionalChains(rootKey);
  return { send: chainFrom(c.b), recv: chainFrom(c.a) };
}

// Per-message nonce derived from the (already unique) message key → unique per
// key without transmitting a nonce. The ratchet guarantees no key repeats.
function nonceFor(messageKey: Uint8Array): Uint8Array {
  return hkdf(sha256, messageKey, undefined, utf8ToBytes('qcipher/v1 nonce'), 12);
}

// The authenticated header (AEAD associated data). Carries the cipher id, epoch,
// and message index so decryption uses exactly what the sender stamped.
function headerBytes(epoch: number, index: number, cipher: CipherId): Uint8Array {
  const head = new Uint8Array(10);
  const dv = new DataView(head.buffer);
  dv.setUint8(0, 1); // version
  dv.setUint32(1, epoch >>> 0, false);
  dv.setUint32(5, index >>> 0, false);
  dv.setUint8(9, CIPHERS.indexOf(cipher));
  return head;
}

export interface Envelope {
  epoch: number;
  index: number;
  cipher: CipherId;
  ciphertext: Uint8Array;
}

/** Encrypt one message. Mutates the session's send chain (advances it). */
export function encrypt(
  session: Session,
  plaintext: Uint8Array,
  epoch: number,
  blockHash: Uint8Array,
): Envelope {
  const { messageKey, next } = step(session.send);
  session.send = next;
  const cipher = selectCipher(epoch, blockHash);
  const aad = headerBytes(epoch, next.index, cipher);
  const ciphertext = seal(cipher, messageKey, nonceFor(messageKey), aad, pad(plaintext));
  return { epoch, index: next.index, cipher, ciphertext };
}

/** Decrypt one message. Mutates the session's recv chain (advances it). */
export function decrypt(session: Session, env: Envelope): Uint8Array {
  const { messageKey, next } = step(session.recv);
  session.recv = next;
  const aad = headerBytes(env.epoch, env.index, env.cipher);
  return unpad(open(env.cipher, messageKey, nonceFor(messageKey), aad, env.ciphertext));
}
