'use client';

import { ReactNode, useState, useEffect } from 'react';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  mainnet,
  sepolia,
  polygon,
  polygonAmoy,
  bsc,
  bscTestnet,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  avalanche,
  avalancheFuji,
} from 'wagmi/chains';

// Config must be created lazily to avoid WalletConnect localStorage access during SSR
let wagmiConfig: ReturnType<typeof getDefaultConfig> | null = null;

function getConfig() {
  if (!wagmiConfig) {
    wagmiConfig = getDefaultConfig({
      appName: 'Pentagonal',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'demo',
      chains: [
        mainnet,
        sepolia,
        polygon,
        polygonAmoy,
        bsc,
        bscTestnet,
        arbitrum,
        arbitrumSepolia,
        base,
        baseSepolia,
        optimism,
        optimismSepolia,
        avalanche,
        avalancheFuji,
      ],
      ssr: true,
    });
  }
  return wagmiConfig;
}

const queryClient = new QueryClient();

export function EVMProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={getConfig()}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#6366f1',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
