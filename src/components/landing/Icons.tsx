// Custom geometric line marks for marketing surface.
// 24×24, currentColor, 1.5px stroke. No emoji.

type IconProps = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ReentrancyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9a5 5 0 0 1 5-5h7" />
      <path d="m13 1 3 3-3 3" />
      <path d="M20 15a5 5 0 0 1-5 5H8" />
      <path d="m11 23-3-3 3-3" />
    </svg>
  );
}

export function FlashLoanIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function AccessControlIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GasIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M4 21h11" />
      <path d="M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3" />
      <path d="M7 8h5" />
    </svg>
  );
}

export function OracleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function MEVIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 6 6 6-6 6" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function OverflowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20h16" />
      <path d="M12 20V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M9 4h6" strokeOpacity="0.4" />
    </svg>
  );
}

export function EconomicIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v18" />
      <path d="M3 8h18" />
      <path d="M3 8l3 7a3 3 0 0 0 6 0L9 8" />
      <path d="M21 8l-3 7a3 3 0 0 1-6 0l3-7" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} viewBox="0 0 16 16" className={className}>
      <path d="M3 8h10" />
      <path d="m9 4 4 4-4 4" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} width={14} height={14} viewBox="0 0 14 14" className={className}>
      <path d="m3 7 3 3 5-6" />
    </svg>
  );
}

// ─── LockDialSpinner ─────────────────────────────────────
// Rotating dial with five pin marks at 72° intervals.
// Inspired by logo concept 03 — used as the busy indicator
// while the user waits for fetches, generation, or the
// audit pipeline to land.
//
// Drop in anywhere with `currentColor` inheritance:
//   <LockDialSpinner size={16} />
// Pair with text: "Auditing..." next to the spinning dial.

export function LockDialSpinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      className={`lock-dial-spinner ${className ?? ''}`}
      aria-hidden="true"
      role="img"
    >
      {/* Static outer ring (rotation-symmetric, but acts as a frame) */}
      <circle cx="32" cy="32" r="22" strokeWidth={2} opacity={0.22} />
      {/* Five pin marks at 72° intervals */}
      <line x1="32" y1="6" x2="32" y2="14" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="56.7" y1="24" x2="49" y2="26.6" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="47.3" y1="53" x2="42.7" y2="46.5" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="16.7" y1="53" x2="21.3" y2="46.5" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="7.3" y1="24" x2="15" y2="26.6" strokeWidth={2.5} strokeLinecap="round" />
      {/* Center hub */}
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  );
}

// ─── Forge UI icons ─────────────────────────────────────
// Used inside /forge to replace emoji in mode toggles, action buttons,
// and the Solana type selector.

export function LightningIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

export function CoinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M9 10h4.5a1.5 1.5 0 0 1 0 3H9" />
      <path d="M9 13h5a1.5 1.5 0 0 1 0 3H9" />
    </svg>
  );
}

export function CogIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <path d="m6 6 3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
    </svg>
  );
}

// Pentagon mark — wordmark glyph used by marketing nav + footer.
// Monogram 'P' with a pentagonal-faceted bowl shoulder.
// The five-sided geometry hides in the bowl; the silhouette is the brand.
export function PentagonMark({ className }: IconProps) {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 64 64"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 8 H40 L54 22 L40 36 H22 V56 H14 Z M22 14 H38 L47 22 L38 30 H22 Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
