import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { generateIdentity, publicBundle } from './handshake';
import { initiatorSession, responderSession, encrypt, decrypt } from './session';
import { step, chainFrom } from './ratchet';
import { serialize, deserialize } from './wire';
import { identityFromSeed } from './identity';

let pass = 0;
const fail: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) pass++;
  else fail.push(name);
}
const dec = (u: Uint8Array) => new TextDecoder().decode(u);
const blk = utf8ToBytes('0xfeedfacecafebeef-block-hash-bytes');

// --- main session: Alice (initiator) <-> Bob (responder), now authenticated ---
const aliceId = generateIdentity();
const bob = generateIdentity();
const { session: alice, handshake } = initiatorSession(aliceId, publicBundle(bob));
const bobSession = responderSession(bob, publicBundle(aliceId), handshake);

// 1. hybrid handshake roundtrip
const e1 = encrypt(alice, utf8ToBytes('hello bob, quantum-safe?'), 21847003, blk);
check('A->B roundtrip', dec(decrypt(bobSession, e1)) === 'hello bob, quantum-safe?');
// 2. reverse direction
const e2 = encrypt(bobSession, utf8ToBytes('yes — x25519 ⊕ ml-kem'), 21847004, blk);
check('B->A roundtrip', dec(decrypt(alice, e2)) === 'yes — x25519 ⊕ ml-kem');
// 3. multi-message in-order (ratchet lockstep)
const e3 = encrypt(alice, utf8ToBytes('second message'), 21847005, blk);
check('A->B message 2', dec(decrypt(bobSession, e3)) === 'second message');

// 4. rotor exercises more than one cipher
const ciphers = new Set<string>();
for (let i = 0; i < 8; i++) ciphers.add(encrypt(alice, utf8ToBytes('x'), 21847006 + i, utf8ToBytes('h' + i)).cipher);
check('rotor exercises >1 cipher', ciphers.size >= 2);

// 5. forward secrecy
const c0 = chainFrom(utf8ToBytes('an arbitrary 32-byte-ish seed!!!'));
const s1 = step(c0);
const s2 = step(s1.next);
check('FS: message keys differ', bytesToHex(s1.messageKey) !== bytesToHex(s2.messageKey));
check('FS: chain key advances', bytesToHex(c0.key) !== bytesToHex(s1.next.key));

// 6. tamper detection (ciphertext)
{
  const aId = generateIdentity();
  const a = initiatorSession(aId, publicBundle(bob));
  const b = responderSession(bob, publicBundle(aId), a.handshake);
  const e = encrypt(a.session, utf8ToBytes('integrity matters'), 1, blk);
  e.ciphertext[5] ^= 0x01;
  let r = false;
  try { decrypt(b, e); } catch { r = true; }
  check('tamper detection (ciphertext)', r);
}

// 7. header auth (cipher id in AAD)
{
  const aId = generateIdentity();
  const a = initiatorSession(aId, publicBundle(bob));
  const b = responderSession(bob, publicBundle(aId), a.handshake);
  const e = encrypt(a.session, utf8ToBytes('selector is authenticated'), 2, blk);
  const forged = { ...e, cipher: (e.cipher === 'aes-256-gcm' ? 'chacha20-poly1305' : 'aes-256-gcm') as typeof e.cipher };
  let r = false;
  try { decrypt(b, forged); } catch { r = true; }
  check('header auth (cipher id in AAD)', r);
}

// 8. wire format — the real on-chain flow
const bobW = generateIdentity();
const aliceWid = generateIdentity();
const aliceW = initiatorSession(aliceWid, publicBundle(bobW));
const wire1 = serialize(encrypt(aliceW.session, utf8ToBytes('first, with handshake'), 9, blk), aliceW.handshake);
const d1 = deserialize(wire1);
check('wire carries handshake', !!d1.handshake);
const bobW2 = responderSession(bobW, publicBundle(aliceWid), d1.handshake!);
check('decrypt from wire (msg 1)', dec(decrypt(bobW2, d1.env)) === 'first, with handshake');
const wire2 = serialize(encrypt(aliceW.session, utf8ToBytes('second, no handshake'), 10, blk));
const d2 = deserialize(wire2);
check('wire omits handshake after first', !d2.handshake);
check('decrypt from wire (msg 2)', dec(decrypt(bobW2, d2.env)) === 'second, no handshake');

// 9. wire metadata tamper rejected
{
  const aId = generateIdentity();
  const a = initiatorSession(aId, publicBundle(bobW));
  const b = responderSession(bobW, publicBundle(aId), a.handshake);
  const w = serialize(encrypt(a.session, utf8ToBytes('metadata is authenticated'), 11, blk), a.handshake);
  w[6] ^= 0x01;
  let r = false;
  try { const d = deserialize(w); decrypt(b, d.env); } catch { r = true; }
  check('wire metadata tamper rejected', r);
}

// 10. wallet-derived identity deterministic
const sig = utf8ToBytes('a deterministic wallet signature blob 0xabc123...');
const idA = identityFromSeed(sig);
const idB = identityFromSeed(sig);
check('identity deterministic (x25519)', bytesToHex(idA.x.publicKey) === bytesToHex(idB.x.publicKey));
check('identity deterministic (ml-kem)', bytesToHex(idA.k.publicKey) === bytesToHex(idB.k.publicKey));
check('identity differs per signature', bytesToHex(idA.k.publicKey) !== bytesToHex(identityFromSeed(utf8ToBytes('different')).k.publicKey));

// 11. AUDIT FIX (HIGH) — sender authentication. An attacker who knows both public
//     bundles but not Alice's secret cannot forge a message Bob accepts as Alice's.
{
  const realAlice = generateIdentity();
  const realBob = generateIdentity();
  const attacker = generateIdentity();
  // the authenticated handshake still works for the legit sender
  const good = initiatorSession(realAlice, publicBundle(realBob));
  const bobFromAlice = responderSession(realBob, publicBundle(realAlice), good.handshake);
  check(
    'authenticated handshake still works',
    dec(decrypt(bobFromAlice, encrypt(good.session, utf8ToBytes('it is really me'), 1, blk))) === 'it is really me',
  );
  // attacker forges to Bob; Bob processes it as if from Alice -> must fail
  const forgery = initiatorSession(attacker, publicBundle(realBob));
  const forged = encrypt(forgery.session, utf8ToBytes('i am alice, trust me'), 1, blk);
  const bobThinksAlice = responderSession(realBob, publicBundle(realAlice), forgery.handshake);
  let blocked = false;
  try { decrypt(bobThinksAlice, forged); } catch { blocked = true; }
  check('IMPERSONATION BLOCKED (sender auth)', blocked);
}

console.log(`\nqcipher crypto core — ${pass} passed, ${fail.length} failed`);
if (fail.length) { console.log('FAILED:', fail.join(', ')); process.exit(1); }
console.log('ALL PASS ✓  (authenticated hybrid handshake · ratchet FS · rotor · authenticated header)');
