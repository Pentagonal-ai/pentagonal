'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles for Solana wallet modal
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaProviderProps {
  children: ReactNode;
  network?: 'devnet' | 'mainnet-beta';
}

export function SolanaProvider({ children, network = 'devnet' }: SolanaProviderProps) {
  const endpoint = useMemo(() => {
    if (network === 'mainnet-beta') {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || clusterApiUrl('mainnet-beta');
    }
    return process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET || clusterApiUrl('devnet');
  }, [network]);

  // Wallet adapters are auto-detected from browser extensions (Phantom, Solflare, Backpack, etc.)
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
