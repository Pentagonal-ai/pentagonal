'use client';

import dynamic from 'next/dynamic';

// Load the wagmi-using panel client-side only — it reads wallet hooks that must
// not run during static prerender (WagmiProviderNotFoundError otherwise).
const MessengerPanel = dynamic(() => import('./MessengerPanel'), { ssr: false });

export default function MessengerMount() {
  return <MessengerPanel />;
}
