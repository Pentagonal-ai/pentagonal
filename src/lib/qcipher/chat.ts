import {
  initiatorSession,
  responderSession,
  encrypt,
  decrypt,
} from './session';
import { serialize, deserialize } from './wire';
import type { Identity, PublicBundle } from './handshake';
import type { CipherId } from './rotor';

// On-chain message model: each message is its own authenticated handshake + one
// sealed AEAD payload (a fresh ephemeral session per message). Stateless and
// reload-safe — no long-lived ratchet to persist — and each message is
// independently forward-secret. The per-message handshake still authenticates the
// sender (static↔static DH). The chaining ratchet remains the v2 path for
// high-frequency chats + post-compromise security.

/** Seal one message addressed to `recipient`. */
export function sealMessage(
  me: Identity,
  recipient: PublicBundle,
  plaintext: Uint8Array,
  epoch: number,
  blockHash: Uint8Array,
): { payload: Uint8Array; cipher: CipherId } {
  const { session, handshake } = initiatorSession(me, recipient);
  const env = encrypt(session, plaintext, epoch, blockHash);
  return { payload: serialize(env, handshake), cipher: env.cipher };
}

/** Try to open a payload addressed to me from `sender`. Returns null if it isn't
 *  decryptable by me (e.g. my own outgoing message, sealed to the other party) —
 *  the AEAD tag makes a wrong-key attempt fail cleanly, so this also tells
 *  incoming messages apart from my own on a shared conversation log. */
export function openMessage(
  me: Identity,
  sender: PublicBundle,
  payload: Uint8Array,
): { plaintext: Uint8Array; cipher: CipherId } | null {
  try {
    const { env, handshake } = deserialize(payload);
    if (!handshake) return null;
    return { plaintext: decrypt(responderSession(me, sender, handshake), env), cipher: env.cipher };
  } catch {
    return null;
  }
}
