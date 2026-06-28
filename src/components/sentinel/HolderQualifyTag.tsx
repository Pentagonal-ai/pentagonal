'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

// Client-only (loaded via next/dynamic with ssr:false) so the wagmi hook never
// runs during static prerender of the home page. Renders the holder-perk tag,
// upgrading to a "you qualify" state when a connected wallet holds >=0.25%.
export function HolderQualifyTag() {
  const { address, isConnected } = useAccount();
  const [qualifies, setQualifies] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isConnected || !address) { setQualifies(null); return; }
    let on = true;
    fetch(`/api/holder-status?address=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on) setQualifies(!!d?.isHolder); })
      .catch(() => {});
    return () => { on = false; };
  }, [address, isConnected]);

  return (
    <div className={qualifies ? 'sn-perk-tag on' : 'sn-perk-tag'}>
      {qualifies ? '✦ You qualify — audits are free for you' : '✦ Token holders'}
    </div>
  );
}
