// ─── Pentagonal Logo ───
// Detailed geometric pentagon logo with nested layers, shield geometry, and circuit-like patterns

export function PentagonLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background glow */}
      <defs>
        <linearGradient id="pent-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="pent-inner" x1="20" y1="16" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id="pent-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer pentagon — main shape */}
      <path
        d="M32 4 L58 23 L48 54 H16 L6 23 Z"
        stroke="url(#pent-gradient)"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />

      {/* Mid pentagon — shield layer */}
      <path
        d="M32 10 L52 25 L44 50 H20 L12 25 Z"
        fill="url(#pent-gradient)"
        opacity="0.08"
        strokeLinejoin="round"
      />
      <path
        d="M32 10 L52 25 L44 50 H20 L12 25 Z"
        stroke="url(#pent-gradient)"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
        strokeLinejoin="round"
      />

      {/* Inner pentagon — core */}
      <path
        d="M32 18 L44 28 L39 43 H25 L20 28 Z"
        fill="url(#pent-inner)"
        opacity="0.2"
        strokeLinejoin="round"
      />
      <path
        d="M32 18 L44 28 L39 43 H25 L20 28 Z"
        stroke="url(#pent-inner)"
        strokeWidth="1.2"
        fill="none"
        opacity="0.8"
        strokeLinejoin="round"
      />

      {/* Center keystone — smallest pentagon */}
      <path
        d="M32 24 L38 30 L36 38 H28 L26 30 Z"
        fill="url(#pent-gradient)"
        opacity="0.35"
        strokeLinejoin="round"
      />

      {/* Vertex connections — circuit traces from outer to inner */}
      <line x1="32" y1="4" x2="32" y2="18" stroke="#818cf8" strokeWidth="0.6" opacity="0.5" />
      <line x1="58" y1="23" x2="44" y2="28" stroke="#818cf8" strokeWidth="0.6" opacity="0.5" />
      <line x1="48" y1="54" x2="39" y2="43" stroke="#818cf8" strokeWidth="0.6" opacity="0.5" />
      <line x1="16" y1="54" x2="25" y2="43" stroke="#818cf8" strokeWidth="0.6" opacity="0.5" />
      <line x1="6" y1="23" x2="20" y2="28" stroke="#818cf8" strokeWidth="0.6" opacity="0.5" />

      {/* Node dots at outer vertices */}
      <circle cx="32" cy="4" r="1.5" fill="#6366f1" />
      <circle cx="58" cy="23" r="1.5" fill="#6366f1" />
      <circle cx="48" cy="54" r="1.5" fill="#6366f1" />
      <circle cx="16" cy="54" r="1.5" fill="#6366f1" />
      <circle cx="6" cy="23" r="1.5" fill="#6366f1" />

      {/* Node dots at inner vertices */}
      <circle cx="32" cy="18" r="1" fill="#818cf8" />
      <circle cx="44" cy="28" r="1" fill="#818cf8" />
      <circle cx="39" cy="43" r="1" fill="#818cf8" />
      <circle cx="25" cy="43" r="1" fill="#818cf8" />
      <circle cx="20" cy="28" r="1" fill="#818cf8" />

      {/* Center accent dot */}
      <circle cx="32" cy="32" r="2" fill="#6366f1" filter="url(#pent-glow)" />

      {/* Cross-bracing lines — geometric reinforcement */}
      <line x1="32" y1="10" x2="32" y2="24" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3" />
      <line x1="12" y1="25" x2="26" y2="30" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3" />
      <line x1="52" y1="25" x2="38" y2="30" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3" />
      <line x1="20" y1="50" x2="28" y2="38" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3" />
      <line x1="44" y1="50" x2="36" y2="38" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3" />
    </svg>
  );
}

// Compact version for tight spaces (header, etc.)
export function PentagonMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M32 4 L58 23 L48 54 H16 L6 23 Z"
        stroke="#6366f1"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M32 18 L44 28 L39 43 H25 L20 28 Z"
        stroke="#6366f1"
        strokeWidth="1.5"
        fill="rgba(99,102,241,0.12)"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="2.5" fill="#6366f1" />
    </svg>
  );
}
