'use client';

import { ReactNode, useState, useEffect } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
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

const rkAccent = { accentColor: '#6366f1', accentColorForeground: 'white', borderRadius: 'medium' as const, fontStack: 'system' as const };

export function EVMProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    // Read initial theme from DOM
    const theme = document.documentElement.getAttribute('data-theme');
    setCurrentTheme(theme === 'dark' ? 'dark' : 'light');

    // Watch for theme changes via MutationObserver
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme');
      setCurrentTheme(t === 'dark' ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={getConfig()}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={currentTheme === 'dark' ? darkTheme(rkAccent) : lightTheme(rkAccent)}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

