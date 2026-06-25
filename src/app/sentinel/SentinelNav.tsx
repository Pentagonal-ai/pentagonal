'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SentinelNav() {
  const path = usePathname() ?? '';
  const onWallets = path.startsWith('/sentinel/wallets');
  return (
    <div className="sn-toggle">
      <Link href="/sentinel" className={!onWallets ? 'on' : ''}>Contracts</Link>
      <Link href="/sentinel/wallets" className={onWallets ? 'on' : ''}>Wallets</Link>
    </div>
  );
}
