'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export function WalletLoginButtons() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleWalletLogin = async (walletAddress: string, walletType: 'evm' | 'solana') => {
    setLoading(true);
    setError('');

    try {
      // Use the server-side wallet auth API
      const response = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, walletType }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Show a clean, user-friendly error
        if (data.requiresConfig) {
          setError('Wallet login needs server configuration. Please use email or social login, or ask the admin to add the Supabase service role key.');
        } else {
          setError(data.error || 'Failed to authenticate with wallet');
        }
        setLoading(false);
        return;
      }

      // Set the session from the server response
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      window.location.href = '/';
    } catch {
      setError('Failed to connect to authentication server');
      setLoading(false);
    }
  };

  return (
    <div className="wallet-auth-section">
      {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <ConnectButton.Custom>
            {({ openConnectModal, account }) => (
              <button
                className="wallet-btn evm"
                onClick={() => {
                  if (account && evmConnected && evmAddress) {
                    handleWalletLogin(evmAddress, 'evm');
                  } else {
                    openConnectModal();
                  }
                }}
                disabled={loading}
              >
                <span style={{ fontSize: '18px' }}>Ξ</span>
                {loading && evmConnected ? 'Signing in...' : evmConnected ? 'Sign in with EVM' : 'EVM Wallet'}
              </button>
            )}
          </ConnectButton.Custom>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            className="wallet-btn solana"
            onClick={() => {
              if (solanaConnected && solanaPublicKey) {
                handleWalletLogin(solanaPublicKey.toBase58(), 'solana');
              } else {
                const btn = document.querySelector('.wallet-adapter-button') as HTMLButtonElement;
                btn?.click();
              }
            }}
            disabled={loading}
          >
            <span style={{ fontSize: '18px' }}>◐</span>
            {loading && solanaConnected ? 'Signing in...' : solanaConnected ? 'Sign in with Solana' : 'Solana Wallet'}
          </button>
          {/* Hidden Solana wallet button for modal trigger */}
          <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: 0 }}>
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </div>
  );
}
