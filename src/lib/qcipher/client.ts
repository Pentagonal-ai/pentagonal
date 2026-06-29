import { keccak256, concat, toHex, hexToBytes } from 'viem';
import { concatBytes } from '@noble/hashes/utils.js';
import { identityFromSeed } from './identity';
import type { Identity, PublicBundle } from './handshake';

// Bridges the Qcipher crypto core to the app/chain: bundle (de)serialization for
// KeyRegistry, the conversation id, and wallet-signature → identity.

const XPUB_LEN = 32;

/** Public bundle stored on-chain in KeyRegistry: xPub || kPub. */
export function serializeBundle(b: PublicBundle): Uint8Array {
  return concatBytes(b.xPub, b.kPub);
}
export function deserializeBundle(bytes: Uint8Array): PublicBundle {
  return { xPub: bytes.slice(0, XPUB_LEN), kPub: bytes.slice(XPUB_LEN) };
}

/** Deterministic conversation id from the two participant addresses (sorted), so
 *  both sides derive the same id and recipients can filter Message logs by it.
 *  v1 is address-based; v2 stealth addresses break this metadata link. */
export function conversationId(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const [lo, hi] = [a.toLowerCase(), b.toLowerCase()].sort() as [`0x${string}`, `0x${string}`];
  return keccak256(concat([lo, hi]));
}

/** Derive the hybrid identity from a wallet signature over IDENTITY_MESSAGE. */
export function deriveIdentity(signatureHex: `0x${string}`): Identity {
  return identityFromSeed(hexToBytes(signatureHex));
}

/** Uint8Array <-> 0x-hex helpers for chain interop (viem-prefixed). */
export const toChainHex = (u: Uint8Array): `0x${string}` => toHex(u);
export const fromChainHex = (h: `0x${string}`): Uint8Array => hexToBytes(h);
