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
      const walletEmail = `${walletAddress.toLowerCase()}@wallet.pentagonal.dev`;
      const walletPassword = `wallet_${walletAddress.toLowerCase()}_pentagonal`;

      // Try sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: walletEmail,
        password: walletPassword,
      });

      if (signInError) {
        // User doesn't exist — create them
        const { error: signUpError } = await supabase.auth.signUp({
          email: walletEmail,
          password: walletPassword,
          options: {
            data: {
              wallet_address: walletAddress,
              wallet_type: walletType,
              auth_method: 'wallet',
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Auto sign-in after signup
        const { error: autoSignInError } = await supabase.auth.signInWithPassword({
          email: walletEmail,
          password: walletPassword,
        });

        if (autoSignInError) {
          setError('Account created. Please sign in again.');
          setLoading(false);
          return;
        }
      }

      window.location.href = '/';
    } catch {
      setError('Failed to authenticate with wallet');
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
                {evmConnected ? 'Sign in with EVM' : 'EVM Wallet'}
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
            {solanaConnected ? 'Sign in with Solana' : 'Solana Wallet'}
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
