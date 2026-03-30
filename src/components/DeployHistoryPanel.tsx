'use client';

import { useState, useEffect } from 'react';
import { getDeployHistory, clearDeployHistory, type DeploymentRecord } from '@/lib/deployHistory';

interface DeployHistoryPanelProps {
  onClose: () => void;
}

const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io', 11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com', 80002: 'https://amoy.polygonscan.com',
  56: 'https://bscscan.com', 97: 'https://testnet.bscscan.com',
  42161: 'https://arbiscan.io', 421614: 'https://sepolia.arbiscan.io',
  8453: 'https://basescan.org', 84532: 'https://sepolia.basescan.org',
  10: 'https://optimistic.etherscan.io', 11155420: 'https://sepolia-optimism.etherscan.io',
  43114: 'https://snowscan.xyz', 43113: 'https://testnet.snowscan.xyz',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DeployHistoryPanel({ onClose }: DeployHistoryPanelProps) {
  const [history, setHistory] = useState<DeploymentRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'evm' | 'solana'>('all');

  useEffect(() => {
    setHistory(getDeployHistory());
  }, []);

  const filtered = filter === 'all' ? history : history.filter(d => d.chainType === filter);

  const handleClear = () => {
    clearDeployHistory();
    setHistory([]);
  };

  return (
    <div className="deploy-panel" style={{ maxHeight: '500px' }}>
      <div className="deploy-panel-header">
        <span className="deploy-panel-title">📋 Deployment History</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {history.length > 0 && (
            <button className="deploy-close-btn" onClick={handleClear} title="Clear history" style={{ fontSize: '12px' }}>
              🗑
            </button>
          )}
          <button className="deploy-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {(['all', 'evm', 'solana'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px', fontSize: '11px', borderRadius: '6px',
              border: filter === f ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: filter === f ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: filter === f ? '#818cf8' : '#94a3b8', cursor: 'pointer',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b' }}>
          {filtered.length} deployment{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#475569' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
            <p>No deployments yet</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Deploy a contract to see it here</p>
          </div>
        ) : (
          filtered.map(record => {
            const explorerBase = EXPLORER_URLS[record.chainId];
            const solscanBase = record.network === 'testnet'
              ? 'https://solscan.io/account/' + record.address + '?cluster=devnet'
              : 'https://solscan.io/account/' + record.address;

            return (
              <div
                key={record.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                    {record.contractName}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{timeAgo(record.timestamp)}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 8px', fontSize: '10px', borderRadius: '4px',
                    background: record.chainType === 'evm' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 84, 255, 0.1)',
                    color: record.chainType === 'evm' ? '#22c55e' : '#9454ff',
                    border: `1px solid ${record.chainType === 'evm' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 84, 255, 0.2)'}`,
                  }}>
                    {record.chain}
                  </span>
                  <span style={{
                    padding: '2px 6px', fontSize: '10px', borderRadius: '4px',
                    background: record.network === 'testnet' ? 'rgba(234, 179, 8, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                    color: record.network === 'testnet' ? '#eab308' : '#22c55e',
                  }}>
                    {record.network}
                  </span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#94a3b8' }}>
                  {record.address.slice(0, 10)}...{record.address.slice(-8)}
                  <button
                    onClick={() => navigator.clipboard.writeText(record.address)}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '12px' }}
                    title="Copy address"
                  >
                    ⎘
                  </button>
                  {record.chainType === 'evm' && explorerBase && (
                    <a
                      href={`${explorerBase}/address/${record.address}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: '6px', color: '#6366f1', fontSize: '11px', textDecoration: 'none' }}
                    >
                      Explorer ↗
                    </a>
                  )}
                  {record.chainType === 'solana' && (
                    <a
                      href={solscanBase}
                      target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: '6px', color: '#9454ff', fontSize: '11px', textDecoration: 'none' }}
                    >
                      Solscan ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
