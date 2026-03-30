'use client';

import { useState, useCallback, useEffect } from 'react';

interface PlaygroundGuideProps {
  code: string;
  onClose: () => void;
}

interface StepState {
  completed: boolean;
  expanded: boolean;
}

const STORAGE_KEY = 'pentagonal-playground-progress';

const STEPS = [
  { id: 1, title: 'Prerequisites', icon: '📋' },
  { id: 2, title: 'Open Solana Playground', icon: '🌐' },
  { id: 3, title: 'Create Anchor Project', icon: '📁' },
  { id: 4, title: 'Paste Your Code', icon: '📋' },
  { id: 5, title: 'Build the Program', icon: '🔨' },
  { id: 6, title: 'Deploy to Devnet', icon: '🚀' },
  { id: 7, title: 'Verify Deployment', icon: '✓' },
  { id: 8, title: 'Mainnet (Optional)', icon: '🌍' },
];

export function SolanaPlaygroundGuide({ code, onClose }: PlaygroundGuideProps) {
  const [steps, setSteps] = useState<StepState[]>(() => {
    // Try restore from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return STEPS.map((_, i) => ({ completed: false, expanded: i === 0 }));
  });

  const [programId, setProgramId] = useState('');
  const [copied, setCopied] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState<number | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(steps)); } catch { /* */ }
  }, [steps]);

  const toggleStep = useCallback((index: number) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, expanded: !s.expanded } : s));
  }, []);

  const completeStep = useCallback((index: number) => {
    setSteps(prev => prev.map((s, i) => {
      if (i === index) return { ...s, completed: true, expanded: false };
      if (i === index + 1) return { ...s, expanded: true };
      return s;
    }));
  }, []);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  }, [code]);

  const resetProgress = useCallback(() => {
    const fresh = STEPS.map((_, i) => ({ completed: false, expanded: i === 0 }));
    setSteps(fresh);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const completedCount = steps.filter(s => s.completed).length;

  return (
    <div className="deploy-panel playground-guide">
      <div className="deploy-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="deploy-panel-title">◐ Anchor Program Deployment</span>
          <span className="playground-progress-badge">{completedCount}/{STEPS.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {completedCount > 0 && (
            <button className="deploy-close-btn" onClick={resetProgress} title="Reset progress" style={{ fontSize: '12px' }}>
              ↺
            </button>
          )}
          <button className="deploy-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="playground-progress-bar">
        <div className="playground-progress-fill" style={{ width: `${(completedCount / STEPS.length) * 100}%` }} />
      </div>

      <div className="playground-steps">
        {STEPS.map((stepInfo, i) => {
          const state = steps[i];
          const isCompleted = state.completed;
          const isExpanded = state.expanded;
          const isLocked = i > 0 && !steps[i - 1].completed && !isExpanded;

          return (
            <div key={stepInfo.id} className={`playground-step ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}>
              {/* Step header */}
              <button
                className="playground-step-header"
                onClick={() => !isLocked && toggleStep(i)}
                disabled={isLocked}
              >
                <div className="playground-step-indicator">
                  {isCompleted ? (
                    <span className="playground-check">✓</span>
                  ) : (
                    <span className="playground-step-num">{stepInfo.id}</span>
                  )}
                </div>
                <span className="playground-step-icon">{stepInfo.icon}</span>
                <span className="playground-step-title">{stepInfo.title}</span>
                <span className="playground-step-chevron">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {/* Step content */}
              {isExpanded && !isLocked && (
                <div className="playground-step-content">
                  {stepInfo.id === 1 && (
                    <>
                      <p>Before deploying your Anchor program, make sure you have:</p>
                      <ul className="playground-checklist">
                        <li>A Solana wallet (Phantom, Solflare, or similar)</li>
                        <li>Some devnet SOL for deployment (~0.5-2 SOL depending on program size)</li>
                        <li>Your generated Anchor/Rust code ready (it&apos;s in the code panel)</li>
                      </ul>
                      <div className="playground-tip">
                        <strong>💡 Tip:</strong> Solana Playground provides a browser-based wallet.
                        You don&apos;t need Rust or Anchor installed locally.
                      </div>
                      <div className="playground-cost-info">
                        <span className="playground-cost-label">Est. Cost (Devnet):</span>
                        <span className="playground-cost-value">~0.5-2 SOL (free via airdrop)</span>
                      </div>
                    </>
                  )}

                  {stepInfo.id === 2 && (
                    <>
                      <p>Open Solana Playground - a browser IDE for Solana programs. No installation needed.</p>
                      <a
                        href="https://beta.solpg.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playground-open-btn"
                      >
                        Open Solana Playground ↗
                      </a>
                      <div className="playground-tip">
                        <strong>💡 Tip:</strong> Solana Playground will generate a browser wallet for you.
                        Fund it with devnet SOL using the &quot;Airdrop&quot; button in the bottom bar.
                      </div>
                    </>
                  )}

                  {stepInfo.id === 3 && (
                    <>
                      <p>In Solana Playground:</p>
                      <ol className="playground-ordered-list">
                        <li>Click <strong>&quot;New Project&quot;</strong> (or the + icon)</li>
                        <li>Choose <strong>&quot;Anchor (Rust)&quot;</strong> as the framework</li>
                        <li>Give it any name (e.g., your contract name)</li>
                        <li>The project will open with a default <code>lib.rs</code> file</li>
                      </ol>
                      <div className="playground-tip">
                        <strong>💡 Tip:</strong> The default template code is just a hello-world.
                        You&apos;ll replace it with your generated Anchor code in the next step.
                      </div>
                    </>
                  )}

                  {stepInfo.id === 4 && (
                    <>
                      <p>Copy your AI-generated Anchor code and paste it into <code>lib.rs</code>:</p>
                      <ol className="playground-ordered-list">
                        <li>Click the button below to copy your code</li>
                        <li>In Solana Playground, select <strong>all</strong> content in <code>src/lib.rs</code></li>
                        <li>Paste (Cmd+V / Ctrl+V) to replace the template</li>
                      </ol>
                      <button className="playground-copy-btn" onClick={handleCopyCode}>
                        {copied ? '✓ Copied!' : '📋 Copy Code to Clipboard'}
                      </button>
                    </>
                  )}

                  {stepInfo.id === 5 && (
                    <>
                      <p>Build your Anchor program in Solana Playground:</p>
                      <ol className="playground-ordered-list">
                        <li>Click the <strong>&quot;Build&quot;</strong> button (🔨) in the left sidebar</li>
                        <li>Wait for the build to complete (usually 15-30 seconds)</li>
                        <li>Check the terminal for <code style={{ color: '#22c55e' }}>Build successful</code></li>
                      </ol>
                      <div className="playground-tip">
                        <strong>⚠️ Build failed?</strong> Come back to Pentagonal and use the
                        auto-fix feature on any audit findings. Then re-copy the fixed code.
                      </div>
                    </>
                  )}

                  {stepInfo.id === 6 && (
                    <>
                      <p>Deploy your built program to Solana Devnet:</p>
                      <ol className="playground-ordered-list">
                        <li>Make sure you&apos;re on <strong>Devnet</strong> (check bottom-left of Playground)</li>
                        <li>Click <strong>&quot;Deploy&quot;</strong> in the left sidebar</li>
                        <li>Confirm the transaction in your Playground wallet</li>
                        <li>Copy the <strong>Program ID</strong> shown after deploy</li>
                      </ol>
                      <div style={{ padding: '8px 12px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#eab308' }}>
                          ⚠️ Always deploy to <strong>Devnet first</strong>. Test thoroughly before mainnet.
                        </span>
                      </div>
                    </>
                  )}

                  {stepInfo.id === 7 && (
                    <>
                      <p>Paste your deployed Program ID below to verify on-chain:</p>
                      <div className="deploy-arg-row">
                        <input
                          type="text"
                          className="deploy-arg-input"
                          placeholder="e.g., 5hG8...x9Rf"
                          value={programId}
                          onChange={(e) => setProgramId(e.target.value)}
                        />
                      </div>
                      {programId && (
                        <a
                          href={`https://solscan.io/account/${programId}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="playground-open-btn"
                          style={{ marginTop: '8px' }}
                        >
                          Verify on Solscan (Devnet) ↗
                        </a>
                      )}
                    </>
                  )}

                  {stepInfo.id === 8 && (
                    <>
                      <p>Once your program works on Devnet, you can deploy to Mainnet:</p>
                      <ol className="playground-ordered-list">
                        <li>Switch to <strong>Mainnet</strong> in Solana Playground settings</li>
                        <li>Fund your wallet with real SOL (~2-5 SOL for deployment)</li>
                        <li>Click Deploy again</li>
                      </ol>
                      <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#ef4444' }}>
                          🔴 Mainnet deployment is irreversible. Double-check your program logic
                          and ensure all audits pass before deploying.
                        </span>
                      </div>
                    </>
                  )}

                  {/* Having trouble? */}
                  <div className="playground-trouble">
                    <button
                      className="playground-trouble-btn"
                      onClick={() => setTroubleOpen(troubleOpen === i ? null : i)}
                    >
                      {troubleOpen === i ? '▾' : '▸'} Having trouble?
                    </button>
                    {troubleOpen === i && (
                      <div className="playground-trouble-content">
                        {stepInfo.id === 1 && "You can get devnet SOL for free via the Playground's built-in airdrop, or via solfaucet.com."}
                        {stepInfo.id === 2 && "Solana Playground works in Chrome-based browsers. If it won't load, try clearing cache or disabling extensions."}
                        {stepInfo.id === 3 && 'Make sure to select "Anchor (Rust)" - not "Native" or "Seahorse". The generated code is Anchor-specific.'}
                        {stepInfo.id === 4 && "If paste doesn't work, try right-click → Paste, or use File → Open to upload a .rs file."}
                        {stepInfo.id === 5 && 'Common build errors: missing use statements (add `use anchor_lang::prelude::*;`), wrong Anchor version. Check error messages carefully.'}
                        {stepInfo.id === 6 && 'If deployment fails, check: (1) sufficient SOL balance, (2) program fits size limits (~10MB), (3) no blocking transactions.'}
                        {stepInfo.id === 7 && 'If Solscan shows no data, wait 30 seconds and refresh. Devnet indexing can be slow.'}
                        {stepInfo.id === 8 && "For mainnet, consider getting a security audit first. Pentagonal's audit feature can help identify issues."}
                      </div>
                    )}
                  </div>

                  {/* Complete step button */}
                  <button
                    className="playground-complete-btn"
                    onClick={() => completeStep(i)}
                  >
                    ✓ Done - Next Step
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All done */}
      {completedCount === STEPS.length && (
        <div className="deploy-section">
          <div className="deploy-success">
            <div className="deploy-success-icon">🎉</div>
            <div className="deploy-success-title">Program Deployed!</div>
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>
              Your Anchor program is live on Solana. You can interact with it
              using the Solana Playground&apos;s test tab or any Solana client library.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
