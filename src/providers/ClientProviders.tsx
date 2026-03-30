'use client';

import { ReactNode } from 'react';
import { EVMProvider } from './EVMProvider';
import { SolanaProvider } from './SolanaProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <EVMProvider>
      <SolanaProvider>
        {children}
      </SolanaProvider>
    </EVMProvider>
  );
}
