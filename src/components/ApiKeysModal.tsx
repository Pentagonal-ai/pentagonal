'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ApiKeysModalProps {
  onClose: () => void;
}

export function ApiKeysModal({ onClose }: ApiKeysModalProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/api-keys');
      if (!res.ok) throw new Error('Failed to load keys');
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      setError('Could not load API keys. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function createKey() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const name = newKeyName.trim() || 'Default';
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');
      setRevealedKey(data.key);
      setRevealedId(data.id);
      setNewKeyName('');
      await fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (revoking) return;
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      if (revealedId === id) {
        setRevealedKey(null);
        setRevealedId(null);
      }
      await fetchKeys();
    } catch {
      setError('Failed to revoke key. Try again.');
    } finally {
      setRevoking(null);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const activeKeys = keys.filter(k => !k.revoked_at);

  return (
    <div className="api-keys-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="api-keys-modal">

        {/* ─── Header ─── */}
        <div className="akm-header">
          <div className="akm-header-text">
            <h2>API Keys</h2>
            <p>Use these keys in Claude Code, MCP clients, or any HTTP client to call Pentagonal tools with your credits.</p>
          </div>
          <button className="akm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ─── Revealed Key Banner ─── */}
        {revealedKey && (
          <div className="akm-reveal-banner">
            <div className="akm-reveal-icon">🔑</div>
            <div className="akm-reveal-content">
              <div className="akm-reveal-label">Copy your key now — it won't be shown again</div>
              <div className="akm-reveal-key">
                <code>{revealedKey}</code>
                <button className="akm-copy-btn" onClick={copyKey}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div className="akm-error">{error}</div>
        )}

        {/* ─── Create new key ─── */}
        <div className="akm-create">
          <div className="akm-create-title">Create new key</div>
          <div className="akm-create-row">
            <input
              className="akm-input"
              type="text"
              placeholder="Key name (e.g. Claude Code, CI Pipeline)"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()}
              maxLength={64}
              disabled={creating || activeKeys.length >= 5}
            />
            <button
              className="akm-create-btn"
              onClick={createKey}
              disabled={creating || activeKeys.length >= 5}
            >
              {creating ? (
                <span className="akm-spinner" />
              ) : (
                '+ Generate'
              )}
            </button>
          </div>
          {activeKeys.length >= 5 && (
            <div className="akm-limit-msg">Max 5 active keys. Revoke one to create another.</div>
          )}
        </div>

        {/* ─── Keys list ─── */}
        <div className="akm-keys-section">
          <div className="akm-section-label">
            Active keys <span className="akm-count">{activeKeys.length} / 5</span>
          </div>

          {loading ? (
            <div className="akm-loading">
              <span className="akm-spinner" />
              Loading keys…
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="akm-empty">
              <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
              </svg>
              <span>No API keys yet. Generate one above.</span>
            </div>
          ) : (
            <div className="akm-key-list">
              {activeKeys.map(key => (
                <div key={key.id} className={`akm-key-row ${revealedId === key.id ? 'akm-key-row--new' : ''}`}>
                  <div className="akm-key-info">
                    <div className="akm-key-name">
                      {key.name}
                      {revealedId === key.id && <span className="akm-new-badge">new</span>}
                    </div>
                    <div className="akm-key-meta">
                      <span>Created {formatDate(key.created_at)}</span>
                      <span className="akm-dot">·</span>
                      <span>Last used {formatDate(key.last_used_at)}</span>
                    </div>
                  </div>
                  <button
                    className="akm-revoke-btn"
                    onClick={() => revokeKey(key.id)}
                    disabled={revoking === key.id}
                    title="Revoke this key"
                  >
                    {revoking === key.id ? <span className="akm-spinner akm-spinner--sm" /> : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Usage hint ─── */}
        <div className="akm-usage">
          <div className="akm-usage-title">How to use</div>
          <div className="akm-code-block">
            <code>{'curl https://www.pentagonal.ai/api/audit-agent \\'}</code>
            <code>{'  -H "x-pentagonal-api-key: pent_..." \\'}</code>
            <code>{'  -d \'{"code": "...", "chain": "ethereum"}\''}</code>
          </div>
          <div className="akm-usage-note">
            Each call deducts 1 credit from your account. <a href="/#pricing" target="_blank" rel="noreferrer">Buy credits →</a>
          </div>
        </div>

      </div>
    </div>
  );
}
