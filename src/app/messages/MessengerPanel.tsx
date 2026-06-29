'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { toHex } from 'viem';
import {
  generateIdentity,
  publicBundle,
  initiatorSession,
  responderSession,
  encrypt,
  decrypt,
  serialize,
  selectCipher,
  deriveIdentity,
  IDENTITY_MESSAGE,
  type Identity,
  type Session,
  type CipherId,
} from '@/lib/qcipher';

type Msg = { mine: boolean; text: string; cipher: CipherId; ct: string };
const td = (u: Uint8Array) => new TextDecoder().decode(u);
const CIPHER_COLOR: Record<CipherId, string> = {
  'aes-256-gcm': '#1D9E75',
  'chacha20-poly1305': '#378ADD',
};

export default function MessengerPanel() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(21847003);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const sessions = useRef<{ mine: Session; peer: Identity; peerSession: Session } | null>(null);

  // The rotor: epoch ticks (simulated blocks here; bound to real Base blocks on deploy).
  useEffect(() => {
    const t = setInterval(() => setEpoch((e) => e + 1), 3200);
    return () => clearInterval(t);
  }, []);
  const blockHash = utf8ToBytes('qcipher-demo-block-' + epoch);
  const cipher = selectCipher(epoch, blockHash);

  // Establish a loopback session once the identity is derived, so the real
  // crypto runs end-to-end before the contracts are live.
  useEffect(() => {
    if (!identity) return;
    const peer = generateIdentity();
    const { session: mine, handshake } = initiatorSession(publicBundle(peer));
    const peerSession = responderSession(peer, handshake);
    sessions.current = { mine, peer, peerSession };
    setMsgs([
      { mine: false, text: 'session established — hybrid X25519 + ML-KEM. say something.', cipher, ct: '' },
    ]);
  }, [identity]); // eslint-disable-line react-hooks/exhaustive-deps

  async function activate() {
    try {
      setBusy(true);
      const sig = await signMessageAsync({ message: IDENTITY_MESSAGE });
      setIdentity(deriveIdentity(sig));
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const s = sessions.current;
    const text = input.trim();
    if (!s || !text) return;
    const env = encrypt(s.mine, utf8ToBytes(text), epoch, blockHash);
    setMsgs((m) => [...m, { mine: true, text, cipher: env.cipher, ct: toHex(serialize(env)).slice(0, 22) + '…' }]);
    setInput('');
    // The peer really decrypts it (proving the crypto), then replies.
    setTimeout(() => {
      const got = decrypt(s.peerSession, env);
      const reply = encrypt(s.peerSession, utf8ToBytes(`received + decrypted: "${td(got)}"`), epoch, blockHash);
      const back = decrypt(s.mine, reply);
      setMsgs((m) => [...m, { mine: false, text: td(back), cipher: reply.cipher, ct: toHex(serialize(reply)).slice(0, 22) + '…' }]);
    }, 850);
  }

  const card: React.CSSProperties = {
    maxWidth: 380, margin: '0 auto', border: '0.5px solid rgba(255,255,255,.12)',
    borderRadius: 20, background: '#15171d', color: '#e9ebf2', overflow: 'hidden',
    fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
  };
  const muted = { color: '#8b92a1' };

  return (
    <div style={card}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>Qcipher</div>
          <div style={{ fontSize: 11, ...muted }}>quantum-safe · on Base</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, ...muted }}>block</div>
          <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'ui-monospace,Menlo,monospace' }}>#{epoch.toLocaleString('en-US')}</div>
        </div>
      </div>

      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: CIPHER_COLOR[cipher], display: 'inline-block' }} />
        <div>
          <div style={{ fontSize: 11, ...muted }}>epoch cipher</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: CIPHER_COLOR[cipher] }}>{cipher}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, ...muted }}>↻ rotates each block</div>
      </div>

      {!isConnected ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, ...muted, marginBottom: 14 }}>connect a wallet to derive your encryption identity.</p>
          <div style={{ display: 'inline-block' }}><ConnectButton /></div>
        </div>
      ) : !identity ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, ...muted, marginBottom: 14 }}>
            sign once to derive your X25519 + ML-KEM identity. it never leaves your device.
          </p>
          <button onClick={activate} disabled={busy} style={{ background: 'rgba(45,212,191,.14)', border: '0.5px solid rgba(255,255,255,.18)', color: '#5eead4', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
            {busy ? 'check your wallet…' : 'activate Qcipher'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 180 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', fontSize: 13, lineHeight: 1.45, padding: '7px 10px', borderRadius: 12, border: '0.5px solid rgba(255,255,255,.1)', background: m.mine ? 'rgba(45,212,191,.14)' : '#1c1f29', color: m.mine ? '#5eead4' : '#e9ebf2' }}>{m.text}</div>
                <div style={{ fontSize: 11, ...muted }}>
                  🔒 {m.cipher.split('-')[0]}{m.ct ? ' · ' + m.ct : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid rgba(255,255,255,.1)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="encrypted message…"
              style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: '0.5px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#e9ebf2', padding: '8px 10px', fontSize: 13, outline: 'none' }}
            />
            <button onClick={send} style={{ width: 38, background: 'rgba(45,212,191,.14)', border: '0.5px solid rgba(255,255,255,.18)', color: '#5eead4', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>↑</button>
          </div>
          <div style={{ padding: '0 14px 12px', fontSize: 10, ...muted }}>
            demo: messages are really encrypted + decrypted by the crypto core (loopback peer). on-chain send lights up at deploy.
          </div>
        </>
      )}
    </div>
  );
}
