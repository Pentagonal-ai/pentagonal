'use client';

// ─── FunctionCallPanel ───────────────────────────────────
// Etherscan-style read/write functions panel for any verified
// EVM contract. Reads use the public client (no signature). Writes
// route through wagmi's useWriteContract, which prompts the user's
// connected wallet via RainbowKit.
//
// Scope (Phase 1): primitive types only — address, uint*, int*,
// bool, string, bytes32. Arrays / tuples / nested structs render
// as raw JSON inputs and pass through with parseAbiTypeValue.

import { useMemo, useState } from 'react';
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { LockDialSpinner } from '@/components/landing/Icons';

type AbiInput = { name: string; type: string };
type AbiOutput = { name: string; type: string };
type AbiFunction = {
  type: 'function';
  name: string;
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
  inputs: AbiInput[];
  outputs: AbiOutput[];
};

type Props = {
  abi: unknown[];
  address: string;
  chainId: number;
};

function isFn(item: unknown): item is AbiFunction {
  if (!item || typeof item !== 'object') return false;
  const o = item as { type?: string; name?: string };
  return o.type === 'function' && typeof o.name === 'string';
}

// Parse a raw string input to the value type expected by the ABI
function parseAbiTypeValue(rawInput: string, type: string): unknown {
  const v = rawInput.trim();
  if (v === '') return undefined;
  if (type === 'bool') return v === 'true' || v === '1';
  if (type.startsWith('uint') || type.startsWith('int')) {
    // big numbers — return as bigint via BigInt
    try { return BigInt(v); } catch { return undefined; }
  }
  if (type === 'address' || type.startsWith('bytes') || type === 'string') return v;
  if (type.endsWith('[]') || type.startsWith('tuple')) {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

// Stringify a value returned from an eth_call for display
function stringifyResult(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  } catch { return String(value); }
}

export function FunctionCallPanel({ abi, address, chainId }: Props) {
  const [tab, setTab] = useState<'read' | 'write'>('read');

  const { reads, writes } = useMemo(() => {
    const fns = (abi as unknown[]).filter(isFn) as AbiFunction[];
    return {
      reads: fns.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure'),
      writes: fns.filter(f => f.stateMutability === 'nonpayable' || f.stateMutability === 'payable'),
    };
  }, [abi]);

  const list = tab === 'read' ? reads : writes;

  if (reads.length === 0 && writes.length === 0) {
    return (
      <div className="f-functions">
        <div className="f-functions-empty">No callable functions found in this ABI.</div>
      </div>
    );
  }

  return (
    <div className="f-functions">
      <div className="f-functions-tabs">
        <button
          type="button"
          onClick={() => setTab('read')}
          className={`f-functions-tab ${tab === 'read' ? 'active' : ''}`}
        >
          Read <span className="f-functions-tab-count">{reads.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`f-functions-tab ${tab === 'write' ? 'active' : ''}`}
        >
          Write <span className="f-functions-tab-count">{writes.length}</span>
        </button>
        {tab === 'write' && <WriteTabConnect targetChainId={chainId} />}
      </div>

      <div className="f-functions-list">
        {list.map((fn, i) => (
          <FunctionRow
            key={`${fn.name}-${i}`}
            fn={fn}
            address={address}
            chainId={chainId}
            mode={tab}
          />
        ))}
      </div>
    </div>
  );
}

// Compact wallet status / connect chip shown next to the Write tab
function WriteTabConnect({ targetChainId }: { targetChainId: number }) {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="f-functions-tab-aside">
        <ConnectButton
          accountStatus="address"
          chainStatus="none"
          showBalance={false}
          label="Connect wallet"
        />
      </div>
    );
  }

  if (currentChainId !== targetChainId) {
    return (
      <div className="f-functions-tab-aside">
        <button
          type="button"
          className="f-functions-switch"
          onClick={() => switchChain({ chainId: targetChainId })}
        >
          Switch network →
        </button>
      </div>
    );
  }

  return null;
}

function FunctionRow({
  fn,
  address,
  chainId,
  mode,
}: {
  fn: AbiFunction;
  address: string;
  chainId: number;
  mode: 'read' | 'write';
}) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<string[]>(() => fn.inputs.map(() => ''));
  const [valueWei, setValueWei] = useState('');
  const [readResult, setReadResult] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [readLoading, setReadLoading] = useState(false);

  const publicClient = usePublicClient({ chainId });
  const { writeContract, data: txHash, isPending: writePending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const setArgAt = (i: number, value: string) => {
    setArgs(prev => prev.map((v, idx) => (idx === i ? value : v)));
  };

  const buildArgs = () => fn.inputs.map((inp, i) => parseAbiTypeValue(args[i] || '', inp.type));

  const callRead = async () => {
    if (!publicClient) {
      setReadError('No RPC client available for this chain.');
      return;
    }
    setReadLoading(true);
    setReadError(null);
    setReadResult(null);
    try {
      const result = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: [fn],
        functionName: fn.name,
        args: buildArgs(),
      });
      setReadResult(stringifyResult(result));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Call failed');
    } finally {
      setReadLoading(false);
    }
  };

  const callWrite = () => {
    resetWrite();
    writeContract({
      address: address as `0x${string}`,
      abi: [fn],
      functionName: fn.name,
      args: buildArgs(),
      value: fn.stateMutability === 'payable' && valueWei ? BigInt(valueWei) : undefined,
      chainId,
    });
  };

  return (
    <div className={`f-functions-row ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="f-functions-row-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="f-functions-row-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="f-functions-row-name">{fn.name}</span>
        <span className="f-functions-row-sig">
          ({fn.inputs.map(i => i.type).join(', ')})
          {fn.outputs.length > 0 && ` → ${fn.outputs.map(o => o.type).join(', ')}`}
        </span>
      </button>

      {open && (
        <div className="f-functions-row-body">
          {fn.inputs.length === 0 && fn.stateMutability !== 'payable' && (
            <div className="f-functions-row-noargs">No inputs.</div>
          )}

          {fn.inputs.map((inp, i) => (
            <label key={i} className="f-functions-arg">
              <span className="f-functions-arg-label">
                {inp.name || `arg${i}`} <span className="f-functions-arg-type">{inp.type}</span>
              </span>
              <input
                type="text"
                value={args[i]}
                onChange={e => setArgAt(i, e.target.value)}
                placeholder={inp.type === 'bool' ? 'true / false' : inp.type === 'address' ? '0x…' : inp.type}
                className="f-functions-arg-input"
                spellCheck={false}
              />
            </label>
          ))}

          {fn.stateMutability === 'payable' && (
            <label className="f-functions-arg">
              <span className="f-functions-arg-label">
                msg.value <span className="f-functions-arg-type">wei</span>
              </span>
              <input
                type="text"
                value={valueWei}
                onChange={e => setValueWei(e.target.value)}
                placeholder="0"
                className="f-functions-arg-input"
                spellCheck={false}
              />
            </label>
          )}

          <div className="f-functions-row-actions">
            {mode === 'read' ? (
              <button
                type="button"
                className="f-functions-call"
                onClick={callRead}
                disabled={readLoading}
              >
                {readLoading ? <><LockDialSpinner size={12} /> Reading</> : 'Query'}
              </button>
            ) : (
              <button
                type="button"
                className="f-functions-call f-functions-call--write"
                onClick={callWrite}
                disabled={writePending || txConfirming}
              >
                {writePending ? <><LockDialSpinner size={12} /> Confirming in wallet</>
                  : txConfirming ? <><LockDialSpinner size={12} /> Mining</>
                  : 'Write'}
              </button>
            )}
          </div>

          {/* Read result */}
          {mode === 'read' && readResult !== null && (
            <pre className="f-functions-result">{readResult}</pre>
          )}
          {mode === 'read' && readError && (
            <div className="f-functions-error">{readError}</div>
          )}

          {/* Write tx hash + confirmation */}
          {mode === 'write' && txHash && (
            <div className="f-functions-tx">
              <span className="f-functions-tx-label">Tx</span>
              <code>{txHash}</code>
              {txConfirmed && <span className="f-functions-tx-status">✓ confirmed</span>}
            </div>
          )}
          {mode === 'write' && writeError && (
            <div className="f-functions-error">{writeError.message}</div>
          )}
        </div>
      )}
    </div>
  );
}
