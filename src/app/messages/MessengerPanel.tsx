'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSignMessage,
  useBlockNumber,
  usePublicClient,
  useWriteContract,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { isAddress, getAddress, numberToHex } from 'viem';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import {
  deriveIdentity,
  IDENTITY_MESSAGE,
  publicBundle,
  serializeBundle,
  deserializeBundle,
  conversationId,
  sealMessage,
  openMessage,
  selectCipher,
  toChainHex,
  fromChainHex,
  QCIPHER,
  KEY_REGISTRY_ABI,
  MESSENGER_ABI,
  type Identity,
  type PublicBundle,
  type CipherId,
} from '@/lib/qcipher';

type Msg = { mine: boolean; text: string; cipher: CipherId; block: number };
const td = (u: Uint8Array) => new TextDecoder().decode(u);
const CIPHER_COLOR: Record<CipherId, string> = {
  'aes-256-gcm': '#5dcaa5',
  'chacha20-poly1305': '#67e8f9',
};
const blockHashFor = (n: bigint | number) => fromChainHex(numberToHex(BigInt(n), { size: 32 }));
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function MessengerPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: QCIPHER.chainId });
  const publicClient = usePublicClient({ chainId: QCIPHER.chainId });
  const { writeContractAsync } = useWriteContract();

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [recipient, setRecipient] = useState('');
  const [peer, setPeer] = useState<{ address: `0x${string}`; bundle: PublicBundle } | null>(null);
  const [lookupMsg, setLookupMsg] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [pins, setPins] = useState<string[]>([]);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const fromBlock = useRef<bigint>(BigInt(0));

  const me = address ? getAddress(address) : null;
  const onWrongChain = isConnected && chainId !== QCIPHER.chainId;
  const epoch = Number(blockNumber ?? BigInt(0));
  const cipher = selectCipher(epoch, blockHashFor(blockNumber ?? BigInt(0)));
  const convoId = me && peer ? conversationId(me, peer.address) : null;
  const cacheKey = convoId ? `qc:msgs:${convoId}` : null;

  // load pinned conversations
  useEffect(() => {
    try {
      const raw = localStorage.getItem('qc:pins');
      if (raw) setPins(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persistPins = (next: string[]) => {
    try {
      localStorage.setItem('qc:pins', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // last cached message of a conversation, for the sidebar preview
  const previewFor = (addr: string): { text: string; block: number } | null => {
    if (!me) return null;
    try {
      const raw = localStorage.getItem(`qc:msgs:${conversationId(me, getAddress(addr))}`);
      if (!raw) return null;
      const arr = JSON.parse(raw) as Msg[];
      const last = arr[arr.length - 1];
      return last ? { text: last.text, block: last.block } : null;
    } catch {
      return null;
    }
  };

  // derive identity from one wallet signature
  const activate = async () => {
    try {
      setBusy('check your wallet…');
      const sig = await signMessageAsync({ message: IDENTITY_MESSAGE });
      setIdentity(deriveIdentity(sig));
    } finally {
      setBusy('');
    }
  };

  // once we have an identity, check whether our key is published
  useEffect(() => {
    if (!identity || !address || !publicClient) return;
    publicClient
      .readContract({ address: QCIPHER.keyRegistry, abi: KEY_REGISTRY_ABI, functionName: 'isRegistered', args: [address] })
      .then((r) => setRegistered(Boolean(r)))
      .catch(() => setRegistered(false));
  }, [identity, address, publicClient]);

  // chain-scan discovery: surface conversations from recent on-chain Messages sent
  // to me. The peer is the tx sender; convoId(me, sender) must match the log's id.
  useEffect(() => {
    if (!identity || !me || !publicClient) return;
    let stop = false;
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const from = latest > BigInt(9000) ? latest - BigInt(9000) : BigInt(0);
        const logs = await publicClient.getContractEvents({
          address: QCIPHER.messenger, abi: MESSENGER_ABI, eventName: 'Message', fromBlock: from, toBlock: latest,
        });
        const txFrom = new Map<string, string>();
        const found = new Set<string>();
        for (const log of logs.slice(-120).reverse()) {
          if (stop) return;
          const cid = (log.args as { convoId?: string }).convoId;
          const txh = log.transactionHash;
          if (!cid || !txh) continue;
          let f = txFrom.get(txh);
          if (!f) {
            try {
              f = (await publicClient.getTransaction({ hash: txh })).from;
              txFrom.set(txh, f);
            } catch {
              continue;
            }
          }
          const fa = getAddress(f);
          if (fa === me) continue; // my own send — peer isn't recoverable from a hash
          if (conversationId(me, fa).toLowerCase() === cid.toLowerCase()) found.add(fa);
        }
        if (!stop && found.size) setDiscovered(Array.from(found));
      } catch {
        /* discovery is best-effort — pins still work */
      }
    })();
    return () => {
      stop = true;
    };
  }, [identity, me, publicClient]);

  const register = async () => {
    if (!identity) return;
    try {
      setBusy('publishing your key…');
      await writeContractAsync({
        address: QCIPHER.keyRegistry,
        abi: KEY_REGISTRY_ABI,
        functionName: 'register',
        args: [toChainHex(serializeBundle(publicBundle(identity)))],
        chainId: QCIPHER.chainId,
      });
      setRegistered(true);
    } catch (e) {
      setBusy((e as Error).message?.slice(0, 80) || 'failed');
      setTimeout(() => setBusy(''), 2500);
      return;
    }
    setBusy('');
  };

  const openConversation = async (addrOverride?: string) => {
    if (!publicClient) return;
    const addr = (addrOverride ?? recipient).trim();
    if (!isAddress(addr)) {
      setLookupMsg('not a valid address');
      return;
    }
    if (me && getAddress(addr) === me) {
      setLookupMsg("that's your own address");
      return;
    }
    setLookupMsg('looking up…');
    try {
      const latest = await publicClient.getBlockNumber();
      const regLogs = await publicClient.getContractEvents({
        address: QCIPHER.keyRegistry,
        abi: KEY_REGISTRY_ABI,
        eventName: 'KeyRegistered',
        args: { user: getAddress(addr) },
        fromBlock: latest > BigInt(10000) ? latest - BigInt(10000) : BigInt(0),
        toBlock: latest,
      });
      const bundleHex = (regLogs[regLogs.length - 1]?.args as { bundle?: `0x${string}` } | undefined)?.bundle;
      if (!bundleHex) {
        setLookupMsg("they haven't joined Qcipher yet");
        return;
      }
      seen.current = new Set();
      fromBlock.current = BigInt(0);
      setMsgs([]);
      const checksummed = getAddress(addr);
      setPeer({ address: checksummed, bundle: deserializeBundle(fromChainHex(bundleHex)) });
      setPins((prev) => {
        const next = Array.from(new Set([checksummed, ...prev]));
        persistPins(next);
        return next;
      });
      setRecipient('');
      setLookupMsg('');
    } catch {
      setLookupMsg('lookup failed — are you on Base?');
    }
  };

  // load cached thread when a conversation opens
  useEffect(() => {
    if (!cacheKey) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [cacheKey]);

  const persist = useCallback(
    (next: Msg[]) => {
      if (cacheKey) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    },
    [cacheKey],
  );

  // poll the chain for new messages in this conversation
  useEffect(() => {
    if (!identity || !peer || !convoId || !publicClient) return;
    let stop = false;
    const tick = async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        if (fromBlock.current === BigInt(0)) fromBlock.current = latest > BigInt(9000) ? latest - BigInt(9000) : BigInt(0);
        const logs = await publicClient.getContractEvents({
          address: QCIPHER.messenger,
          abi: MESSENGER_ABI,
          eventName: 'Message',
          args: { convoId },
          fromBlock: fromBlock.current,
          toBlock: latest,
        });
        fromBlock.current = latest + BigInt(1);
        const fresh: Msg[] = [];
        for (const log of logs) {
          const id = `${log.transactionHash}:${log.logIndex}`;
          if (seen.current.has(id)) continue;
          seen.current.add(id);
          const payload = (log.args as { payload?: `0x${string}` }).payload;
          if (!payload) continue;
          const opened = openMessage(identity, peer.bundle, fromChainHex(payload));
          if (opened) fresh.push({ mine: false, text: td(opened.plaintext), cipher: opened.cipher, block: Number(log.blockNumber) });
        }
        if (fresh.length && !stop) {
          setMsgs((m) => {
            const next = [...m, ...fresh].sort((a, b) => a.block - b.block);
            persist(next);
            return next;
          });
        }
      } catch {
        /* transient RPC hiccup — try again next tick */
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [identity, peer, convoId, publicClient, persist]);

  const send = async () => {
    if (!identity || !peer || !convoId || !blockNumber) return;
    const text = input.trim();
    if (!text) return;
    setInput('');
    const { payload, cipher: used } = sealMessage(identity, peer.bundle, utf8ToBytes(text), epoch, blockHashFor(blockNumber));
    setMsgs((m) => {
      const next = [...m, { mine: true, text, cipher: used, block: epoch }];
      persist(next);
      return next;
    });
    try {
      setBusy('sealing → writing to Base…');
      await writeContractAsync({
        address: QCIPHER.messenger,
        abi: MESSENGER_ABI,
        functionName: 'send',
        args: [convoId, BigInt(epoch), payload.length ? toChainHex(payload) : '0x'],
        chainId: QCIPHER.chainId,
      });
      setBusy('');
    } catch (e) {
      setBusy((e as Error).message?.slice(0, 80) || 'send failed');
      setTimeout(() => setBusy(''), 3000);
    }
  };

  const convos = Array.from(new Set([...pins, ...discovered]))
    .map((addr) => ({ addr, pv: previewFor(addr) }))
    .sort((a, b) => (b.pv?.block ?? 0) - (a.pv?.block ?? 0));

  // ── onboarding: connect → switch → activate → publish key ──
  if (!registered) {
    return (
      <div className="qc-root">
        <div className="qc-welcome">
          <div className="qc-w-mark">Qcipher</div>
          <p className="qc-w-tag">Quantum-safe encrypted messages, written on-chain behind a cipher the chain rotates every block.</p>
          <div className="qc-w-feats">
            <div className="qc-feat">
              <span className="qc-feat-ic"><IShield c="#a78bfa" /></span>
              <div><div className="qc-feat-h">Hybrid post-quantum</div><div className="qc-feat-d">X25519 + ML-KEM-768 — sealed against tomorrow&apos;s quantum computers, today.</div></div>
            </div>
            <div className="qc-feat">
              <span className="qc-feat-ic"><ICube c="#67e8f9" /></span>
              <div><div className="qc-feat-h">Written on-chain</div><div className="qc-feat-d">Posted to Base — no servers, no inboxes, keys only you hold.</div></div>
            </div>
          </div>
          <div className="qc-w-note">
            <IEye c="#6b665d" />
            <span>How private: the <b>ciphertext is public</b> on-chain, and so are the sender + recipient addresses. Only the message <b>content</b> is encrypted — readable solely with your key.</span>
          </div>
          <div className="qc-w-cta">
            {!isConnected ? (
              <><p className="qc-w-step">Connect a wallet to derive your encryption identity.</p><ConnectButton /></>
            ) : onWrongChain ? (
              <><p className="qc-w-step">Qcipher runs on Base.</p><button className="qc-btn" onClick={() => switchChain({ chainId: QCIPHER.chainId })}>Switch to Base</button></>
            ) : !identity ? (
              <><p className="qc-w-step">Sign once to derive your X25519 + ML-KEM identity. It never leaves your device.</p><button className="qc-btn" onClick={activate} disabled={!!busy}>{busy || 'Activate Qcipher'}</button></>
            ) : (
              <><p className="qc-w-step">Publish your public key on-chain so others can message you. One-time, costs a fraction of a cent.</p><button className="qc-btn" onClick={register} disabled={!!busy}>{busy || 'Publish my key'}</button></>
            )}
          </div>
          <div className="qc-w-rotor"><IRefresh c="#6b665d" /> cipher now: {cipher} · block #{epoch.toLocaleString('en-US')}</div>
        </div>
      </div>
    );
  }

  // ── active messenger ──
  return (
    <div className="qc-root">
      <div className={`qc-app${peer ? ' has-peer' : ''}`}>
        <aside className="qc-side">
          <div className="qc-brand"><span className="qc-brand-mark"><IAtom c="#67e8f9" /></span><span className="qc-wordmark">Qcipher</span></div>
          <div className="qc-id">
            <span className="qc-avatar">{me ? me.slice(2, 4).toUpperCase() : ''}</span>
            <div><div className="qc-id-addr">{me ? short(me) : ''}</div><div className="qc-id-reg"><ICheck c="#5dcaa5" />registered</div></div>
          </div>
          <div className="qc-new">
            <div className="qc-new-row">
              <input className="qc-input" placeholder="0x… address to message" value={recipient} onChange={(e) => setRecipient(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') openConversation(); }} />
              <button className="qc-btn" onClick={() => openConversation()}>Open</button>
            </div>
            {lookupMsg && <div className="qc-lookup">{lookupMsg}</div>}
          </div>
          <div className="qc-list">
            <div className="qc-list-label">{convos.length ? 'Conversations' : 'No conversations yet'}</div>
            {convos.map(({ addr, pv }) => {
              const active = !!peer && getAddress(peer.address) === getAddress(addr);
              return (
                <div key={addr} className={`qc-convo${active ? ' active' : ''}`} onClick={() => openConversation(addr)}>
                  <span className="qc-avatar">{addr.slice(2, 4).toUpperCase()}</span>
                  <div className="qc-convo-main">
                    <div className="qc-convo-top"><span className="qc-convo-addr">{short(addr)}</span>{pv && <span className="qc-convo-time">#{pv.block.toLocaleString('en-US')}</span>}</div>
                    <div className="qc-convo-prev">{pv ? pv.text : 'tap to open'}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="qc-rotor">
            <div className="qc-rotor-top"><IRefresh c="#fb923c" /> cipher · block #{epoch.toLocaleString('en-US')}</div>
            <div className="qc-rotor-cipher" style={{ color: CIPHER_COLOR[cipher] }}>{cipher}</div>
          </div>
        </aside>

        <section className="qc-main">
          {!peer ? (
            <div className="qc-msgs"><div className="qc-empty">Pick a conversation, or paste an address above to start one. Every message is sealed end-to-end and written to Base.</div></div>
          ) : (
            <>
              <div className="qc-conv-head">
                <button className="qc-back" onClick={() => setPeer(null)} aria-label="Back"><IBack c="#9a958c" /></button>
                <span className="qc-conv-peer">{short(peer.address)}</span>
                <span className="qc-badge safe"><ILock c="#5dcaa5" />quantum-safe</span>
                <span className="qc-badge pub"><IEye c="#9a958c" />ciphertext public</span>
              </div>
              <div className="qc-msgs">
                {msgs.length === 0 && <div className="qc-empty">No messages yet — say something. It&apos;s sealed with this block&apos;s cipher and written to Base.</div>}
                {msgs.map((m, i) => (
                  <div key={i} className={`qc-msg ${m.mine ? 'mine' : 'theirs'}`}>
                    <div className="qc-bubble">{m.text}</div>
                    <div className="qc-meta"><span className="qc-dot" style={{ background: CIPHER_COLOR[m.cipher] }} />{m.cipher} · #{m.block.toLocaleString('en-US')}</div>
                  </div>
                ))}
              </div>
              <div className="qc-composer">
                <input className="qc-input" placeholder="Type an encrypted message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
                <button className="qc-btn qc-send" onClick={send} aria-label="Send"><ISend c="#2a1c0a" /></button>
              </div>
              {busy && <div className="qc-busy">{busy}</div>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function IShield({ c }: { c: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" /><path d="M9.2 12l1.9 1.9 3.7-3.9" /></svg>;
}
function ICube({ c }: { c: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>;
}
function IAtom({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="1.7" fill={c} stroke="none" /><ellipse cx="12" cy="12" rx="10" ry="4.3" /><ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(120 12 12)" /></svg>;
}
function ILock({ c }: { c: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
}
function IEye({ c }: { c: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function ICheck({ c }: { c: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>;
}
function IRefresh({ c }: { c: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5" /></svg>;
}
function ISend({ c }: { c: string }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}
function IBack({ c }: { c: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
}
