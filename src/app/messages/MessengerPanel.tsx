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
  'aes-256-gcm': '#1D9E75',
  'chacha20-poly1305': '#378ADD',
};
const blockHashFor = (n: bigint | number) => fromChainHex(numberToHex(BigInt(n), { size: 32 }));

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
  const seen = useRef<Set<string>>(new Set());
  const fromBlock = useRef<bigint>(BigInt(0));

  const onWrongChain = isConnected && chainId !== QCIPHER.chainId;
  const epoch = Number(blockNumber ?? BigInt(0));
  const cipher = selectCipher(epoch, blockHashFor(blockNumber ?? BigInt(0)));
  const convoId = address && peer ? conversationId(address, peer.address) : null;
  const cacheKey = convoId ? `qc:msgs:${convoId}` : null;

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

  const openConversation = async () => {
    if (!publicClient) return;
    const addr = recipient.trim();
    if (!isAddress(addr)) {
      setLookupMsg('not a valid address');
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
      setMsgs([]);
      setPeer({ address: getAddress(addr), bundle: deserializeBundle(fromChainHex(bundleHex)) });
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

  const card: React.CSSProperties = {
    maxWidth: 380, margin: '0 auto', border: '0.5px solid rgba(255,255,255,.12)',
    borderRadius: 20, background: '#15171d', color: '#e9ebf2', overflow: 'hidden',
    fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
  };
  const muted = { color: '#8b92a1' };
  const btn: React.CSSProperties = { background: 'rgba(45,212,191,.14)', border: '0.5px solid rgba(255,255,255,.18)', color: '#5eead4', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' };
  const field: React.CSSProperties = { flex: 1, background: 'rgba(255,255,255,.06)', border: '0.5px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#e9ebf2', padding: '8px 10px', fontSize: 13, outline: 'none' };

  return (
    <div style={card}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>Qcipher</div>
          <div style={{ fontSize: 11, ...muted }}>quantum-safe · Base</div>
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
        <Center><p style={p(muted)}>connect a wallet to derive your encryption identity.</p><ConnectButton /></Center>
      ) : onWrongChain ? (
        <Center><p style={p(muted)}>Qcipher runs on Base for now.</p><button style={btn} onClick={() => switchChain({ chainId: QCIPHER.chainId })}>switch to Base</button></Center>
      ) : !identity ? (
        <Center><p style={p(muted)}>sign once to derive your X25519 + ML-KEM identity — it never leaves your device.</p><button style={btn} onClick={activate} disabled={!!busy}>{busy || 'activate Qcipher'}</button></Center>
      ) : registered === false ? (
        <Center><p style={p(muted)}>publish your public key on-chain so others can message you (one-time).</p><button style={btn} onClick={register} disabled={!!busy}>{busy || 'publish my key'}</button></Center>
      ) : !peer ? (
        <Center>
          <p style={p(muted)}>message any registered address.</p>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input style={field} placeholder="0x… recipient address" value={recipient} onChange={(e) => setRecipient(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') openConversation(); }} />
            <button style={btn} onClick={openConversation}>open</button>
          </div>
          {lookupMsg && <p style={{ fontSize: 12, marginTop: 10, ...muted }}>{lookupMsg}</p>}
        </Center>
      ) : (
        <>
          <div style={{ padding: '8px 14px', borderBottom: '0.5px solid rgba(255,255,255,.1)', fontSize: 12, ...muted }}>
            to <span style={{ color: '#e9ebf2' }}>{peer.address.slice(0, 6)}…{peer.address.slice(-4)}</span>
            <span onClick={() => setPeer(null)} style={{ float: 'right', cursor: 'pointer', color: '#5eead4' }}>new</span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 180, maxHeight: 320, overflowY: 'auto' }}>
            {msgs.length === 0 && <p style={{ fontSize: 12, textAlign: 'center', ...muted }}>no messages yet — say something.</p>}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', fontSize: 13, lineHeight: 1.45, padding: '7px 10px', borderRadius: 12, border: '0.5px solid rgba(255,255,255,.1)', background: m.mine ? 'rgba(45,212,191,.14)' : '#1c1f29', color: m.mine ? '#5eead4' : '#e9ebf2' }}>{m.text}</div>
                <div style={{ fontSize: 11, ...muted }}>🔒 {m.cipher.split('-')[0]} · #{m.block.toLocaleString('en-US')}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid rgba(255,255,255,.1)', display: 'flex', gap: 8 }}>
            <input style={field} placeholder="encrypted message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
            <button style={{ ...btn, width: 38, padding: 0 }} onClick={send}>↑</button>
          </div>
          {busy && <div style={{ padding: '0 14px 10px', fontSize: 11, ...muted }}>{busy}</div>}
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>{children}</div>;
}
function p(muted: React.CSSProperties): React.CSSProperties {
  return { fontSize: 13, margin: 0, ...muted };
}
