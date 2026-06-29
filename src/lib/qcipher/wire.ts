import { concatBytes } from '@noble/hashes/utils.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { CIPHERS, type CipherId } from './rotor.js';
import type { Envelope } from './session.js';
import type { HandshakeMessage } from './handshake.js';

// Canonical byte encoding of one on-chain message payload — exactly what goes in
// the Messenger event's `payload` field. The epoch/index/cipher fields are in the
// clear but AEAD-authenticated (the receiver recomputes the header as AAD, so any
// tamper fails decryption). Layout:
//   [u8 version=1][u8 flags][u32 epoch][u32 index][u8 cipherIdx][handshake?][ciphertext]
//   flags bit0 = handshake present (first message): [ephX(32)][kemCt(KEMCT_LEN)]

const VERSION = 1;
const F_HANDSHAKE = 0x01;
const META_LEN = 11; // version + flags + epoch(4) + index(4) + cipherIdx(1)
const EPHX_LEN = 32;
const KEMCT_LEN = ml_kem768.lengths.cipherText as number;

export function serialize(env: Envelope, handshake?: HandshakeMessage): Uint8Array {
  const meta = new Uint8Array(META_LEN);
  const dv = new DataView(meta.buffer);
  dv.setUint8(0, VERSION);
  dv.setUint8(1, handshake ? F_HANDSHAKE : 0);
  dv.setUint32(2, env.epoch >>> 0, false);
  dv.setUint32(6, env.index >>> 0, false);
  dv.setUint8(10, CIPHERS.indexOf(env.cipher));
  const parts: Uint8Array[] = [meta];
  if (handshake) parts.push(handshake.ephX, handshake.kemCt);
  parts.push(env.ciphertext);
  return concatBytes(...parts);
}

export function deserialize(bytes: Uint8Array): { env: Envelope; handshake?: HandshakeMessage } {
  if (bytes.length < META_LEN) throw new Error('qcipher: wire payload too short');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint8(0) !== VERSION) throw new Error('qcipher: unknown wire version');
  const flags = dv.getUint8(1);
  const epoch = dv.getUint32(2, false);
  const index = dv.getUint32(6, false);
  const cipher: CipherId | undefined = CIPHERS[dv.getUint8(10)];
  if (!cipher) throw new Error('qcipher: unknown cipher index');

  let off = META_LEN;
  let handshake: HandshakeMessage | undefined;
  if (flags & F_HANDSHAKE) {
    if (bytes.length < off + EPHX_LEN + KEMCT_LEN) throw new Error('qcipher: truncated handshake');
    handshake = {
      ephX: bytes.slice(off, off + EPHX_LEN),
      kemCt: bytes.slice(off + EPHX_LEN, off + EPHX_LEN + KEMCT_LEN),
    };
    off += EPHX_LEN + KEMCT_LEN;
  }
  return { env: { epoch, index, cipher, ciphertext: bytes.slice(off) }, handshake };
}
