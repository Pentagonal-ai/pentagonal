// Pad plaintext to a fixed bucket BEFORE encryption so the on-chain ciphertext
// size leaks no message length. Wire layout: [u32 length][plaintext][zero fill].

const BUCKETS = [256, 1024, 4096, 16384, 65536];

function bucketFor(n: number): number {
  for (const b of BUCKETS) if (n <= b) return b;
  return Math.ceil(n / 65536) * 65536; // beyond the largest bucket, step by 64KiB
}

export function pad(plaintext: Uint8Array): Uint8Array {
  const size = bucketFor(4 + plaintext.length);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, plaintext.length, false);
  out.set(plaintext, 4);
  return out;
}

export function unpad(padded: Uint8Array): Uint8Array {
  if (padded.length < 4) throw new Error('qcipher: padded payload too short');
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0, false);
  if (len > padded.length - 4) throw new Error('qcipher: invalid padding length');
  return padded.slice(4, 4 + len);
}
