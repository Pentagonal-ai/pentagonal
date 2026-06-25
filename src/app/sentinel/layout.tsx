import './sentinel.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import SentinelNav from './SentinelNav';

export const metadata = {
  title: 'Pentagonal Sentinel — continuous smart-contract security',
};

export default function SentinelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sn">
      <div className="sn-top">
        <Link href="/sentinel" className="sn-brand">
          <span className="sn-pm">P</span><b>Pentagonal</b><span className="s">Sentinel</span>
        </Link>
        <SentinelNav />
        <span className="sn-live"><span className="d" />Monitoring</span>
      </div>
      {children}
    </div>
  );
}
