import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { generateIdentity, publicBundle } from './handshake';
import { initiatorSession, responderSession, encrypt, decrypt } from './session';
import { step, chainFrom } from './ratchet';

let pass = 0;
const fail: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) pass++;
  else fail.push(name);
}
const dec = (u: Uint8Array) => new TextDecoder().decode(u);
const blk = utf8ToBytes('0xfeedfacecafebeef-block-hash-bytes');

// --- establish a session: Alice (initiator) -> Bob (responder) ---
const bob = generateIdentity();
const { session: alice, handshake } = initiatorSession(publicBundle(bob));
const bobSession = responderSession(bob, handshake);

// 1. hybrid handshake roundtrip (both sides derived the same root → A->B decrypts)
const e1 = encrypt(alice, utf8ToBytes('hello bob, quantum-safe?'), 21847003, blk);
check('A->B roundtrip', dec(decrypt(bobSession, e1)) === 'hello bob, quantum-safe?');

// 2. reverse direction works independently
const e2 = encrypt(bobSession, utf8ToBytes('yes — x25519 ⊕ ml-kem'), 21847004, blk);
check('B->A roundtrip', dec(decrypt(alice, e2)) === 'yes — x25519 ⊕ ml-kem');

// 3. multi-message in-order keeps working (ratchet advances in lockstep)
const e3 = encrypt(alice, utf8ToBytes('second message'), 21847005, blk);
check('A->B message 2', dec(decrypt(bobSession, e3)) === 'second message');

// 4. cipher rotor actually selects across the suite as the epoch/blockhash vary
const ciphers = new Set<string>();
for (let i = 0; i < 8; i++) {
  ciphers.add(encrypt(alice, utf8ToBytes('x'), 21847006 + i, utf8ToBytes('h' + i)).cipher);
}
check('rotor exercises >1 cipher', ciphers.size >= 2);

// 5. forward secrecy: consecutive message keys differ and are one-way
const c0 = chainFrom(utf8ToBytes('an arbitrary 32-byte-ish seed!!!'));
const s1 = step(c0);
const s2 = step(s1.next);
check('FS: message keys differ', bytesToHex(s1.messageKey) !== bytesToHex(s2.messageKey));
check('FS: chain key advances', bytesToHex(c0.key) !== bytesToHex(s1.next.key));

// 6. tamper detection: flip a ciphertext byte → AEAD auth must reject
const alice2 = initiatorSession(publicBundle(bob));
const bob2 = responderSession(bob, alice2.handshake);
const e6 = encrypt(alice2.session, utf8ToBytes('integrity matters'), 1, blk);
e6.ciphertext[5] ^= 0x01;
let tamperRejected = false;
try { decrypt(bob2, e6); } catch { tamperRejected = true; }
check('tamper detection (ciphertext)', tamperRejected);

// 7. header authentication: changing the stamped cipher id must reject
const alice3 = initiatorSession(publicBundle(bob));
const bob3 = responderSession(bob, alice3.handshake);
const e7 = encrypt(alice3.session, utf8ToBytes('selector is authenticated'), 2, blk);
const forged = { ...e7, cipher: (e7.cipher === 'aes-256-gcm' ? 'chacha20-poly1305' : 'aes-256-gcm') as typeof e7.cipher };
let headerRejected = false;
try { decrypt(bob3, forged); } catch { headerRejected = true; }
check('header auth (cipher id in AAD)', headerRejected);

// 8. wire format: the real on-chain flow — initiator serializes msg+handshake,
//    responder deserializes, builds its session FROM the wire handshake, decrypts.
import { serialize, deserialize } from './wire';
const bobW = generateIdentity();
const aliceW = initiatorSession(publicBundle(bobW));
const wire1 = serialize(encrypt(aliceW.session, utf8ToBytes('first, with handshake'), 9, blk), aliceW.handshake);
const d1 = deserialize(wire1);
check('wire carries handshake', !!d1.handshake);
const bobW2 = responderSession(bobW, d1.handshake!);
check('decrypt from wire (msg 1)', dec(decrypt(bobW2, d1.env)) === 'first, with handshake');
const wire2 = serialize(encrypt(aliceW.session, utf8ToBytes('second, no handshake'), 10, blk));
const d2 = deserialize(wire2);
check('wire omits handshake after first', !d2.handshake);
check('decrypt from wire (msg 2)', dec(decrypt(bobW2, d2.env)) === 'second, no handshake');

// 9. tampering the cleartext wire metadata must fail (it's AEAD-authenticated)
const aliceT = initiatorSession(publicBundle(bobW));
const bobT = responderSession(bobW, aliceT.handshake);
const wireT = serialize(encrypt(aliceT.session, utf8ToBytes('metadata is authenticated'), 11, blk), aliceT.handshake);
wireT[6] ^= 0x01; // flip a byte of the epoch field
let wireTamperRejected = false;
try { const d = deserialize(wireT); decrypt(bobT, d.env); } catch { wireTamperRejected = true; }
check('wire metadata tamper rejected', wireTamperRejected);

// 10. wallet-derived identity is deterministic (same signature → same keys)
import { identityFromSeed } from './identity';
const sig = utf8ToBytes('a deterministic wallet signature blob 0xabc123...');
const idA = identityFromSeed(sig);
const idB = identityFromSeed(sig);
check('identity deterministic (x25519)', bytesToHex(idA.x.publicKey) === bytesToHex(idB.x.publicKey));
check('identity deterministic (ml-kem)', bytesToHex(idA.k.publicKey) === bytesToHex(idB.k.publicKey));
const idC = identityFromSeed(utf8ToBytes('a different signature'));
check('identity differs per signature', bytesToHex(idA.k.publicKey) !== bytesToHex(idC.k.publicKey));

console.log(`\nqcipher crypto core — ${pass} passed, ${fail.length} failed`);
if (fail.length) { console.log('FAILED:', fail.join(', ')); process.exit(1); }
console.log('ALL PASS ✓  (hybrid PQ handshake · ratchet FS · rotor · authenticated header)');
