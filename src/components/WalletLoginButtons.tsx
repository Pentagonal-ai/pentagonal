'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useRef } from 'react';

/* ── Inline SVG chain logos ── */
const EthLogo = () => (
  <svg width="20" height="20" viewBox="0 0 256 417" fill="none">
    <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" fill="#c8c8c8"/>
    <path d="M127.962 0L0 212.32L127.962 287.958V154.158V0Z" fill="#fff"/>
    <path d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L255.999 236.585L127.961 312.187Z" fill="#c8c8c8"/>
    <path d="M127.962 416.905V312.187L0 236.585L127.962 416.905Z" fill="#fff"/>
    <path d="M127.961 287.958L255.921 212.321L127.961 154.159V287.958Z" fill="#8c8c8c"/>
    <path d="M0 212.321L127.96 287.958V154.159L0 212.321Z" fill="#c8c8c8"/>
  </svg>
);

const SolLogo = () => (
  <svg width="20" height="20" viewBox="0 0 397 312" fill="none">
    <path d="M64.6 237.9a12.3 12.3 0 0 1 8.7-3.6h311.8c5.5 0 8.2 6.6 4.4 10.4l-62.7 62.7c-2.3 2.3-5.4 3.6-8.7 3.6H6.3c-5.5 0-8.2-6.6-4.4-10.4l62.7-62.7z" fill="url(#sol-a)"/>
    <path d="M64.6 3.8A12.6 12.6 0 0 1 73.3.2h311.8c5.5 0 8.2 6.6 4.4 10.4l-62.7 62.7a12.3 12.3 0 0 1-8.7 3.6H6.3c-5.5 0-8.2-6.6-4.4-10.4L64.6 3.8z" fill="url(#sol-b)"/>
    <path d="M332.5 120.4a12.3 12.3 0 0 0-8.7-3.6H12c-5.5 0-8.2 6.6-4.4 10.4l62.7 62.7c2.3 2.3 5.4 3.6 8.7 3.6h311.8c5.5 0 8.2-6.6 4.4-10.4l-62.7-62.7z" fill="url(#sol-c)"/>
    <defs>
      <linearGradient id="sol-a" x1="358.7" y1="-18.5" x2="137.1" y2="353.6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="sol-b" x1="264.6" y1="-72.1" x2="43" y2="300" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <linearGradient id="sol-c" x1="311.3" y1="-45.5" x2="89.7" y2="327" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
    </defs>
  </svg>
);

export function WalletLoginButtons() {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authTriggeredRef = useRef<string | null>(null);

  const supabase = createClient();

  const handleWalletLogin = async (walletAddress: string, walletType: 'evm' | 'solana') => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, walletType }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.requiresConfig) {
          setError('Wallet login needs server configuration. Please use email or social login.');
        } else {
          setError(data.error || 'Failed to authenticate with wallet');
        }
        setLoading(false);
        authTriggeredRef.current = null; // Allow retry
        return;
      }

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
      authTriggeredRef.current = null; // Allow retry
    }
  };

  // Auto-login when EVM wallet connects
  useEffect(() => {
    if (evmConnected && evmAddress && authTriggeredRef.current !== evmAddress) {
      authTriggeredRef.current = evmAddress;
      handleWalletLogin(evmAddress, 'evm');
    }
  }, [evmConnected, evmAddress]);

  // Auto-login when Solana wallet connects
  useEffect(() => {
    if (solanaConnected && solanaPublicKey && authTriggeredRef.current !== solanaPublicKey.toBase58()) {
      authTriggeredRef.current = solanaPublicKey.toBase58();
      handleWalletLogin(solanaPublicKey.toBase58(), 'solana');
    }
  }, [solanaConnected, solanaPublicKey]);

  return (
    <div className="wallet-auth-section">
      {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="wallet-btn-row">
        <div className="wallet-btn-wrapper">
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
                <EthLogo />
                {loading && evmConnected ? 'Signing in…' : evmConnected ? 'Sign in with EVM' : 'Ethereum'}
              </button>
            )}
          </ConnectButton.Custom>
        </div>
        <div className="wallet-btn-wrapper">
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
            <SolLogo />
            {loading && solanaConnected ? 'Signing in…' : solanaConnected ? 'Sign in with Solana' : 'Solana'}
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
