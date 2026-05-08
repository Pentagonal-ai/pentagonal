import type { Metadata } from 'next';
import Link from 'next/link';
import '../marketing.css';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';

export const metadata: Metadata = {
  title: 'Logo mockups — Pentagonal',
  robots: { index: false, follow: false },
};

// ─── Logo concept components ────────────────────────────
// Each is a 64×64 viewBox using currentColor.
// Same scale and stroke conventions as the real wordmark mark.

function CurrentDualPentagon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 4 L58.6 23.4 L48.4 54.7 H15.6 L5.4 23.4 Z" strokeWidth={2.5} />
      <path d="M32 45 L19.6 36 L24.3 21.5 H39.7 L44.4 36 Z" strokeWidth={1.75} opacity={0.55} />
    </svg>
  );
}

// 1. Sentinels — five wedge blades radiating from a center hub.
//    No pentagon outline. Reads as five guardians at posts.
function Sentinels() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      {[0, 72, 144, 216, 288].map(angle => (
        <g key={angle} transform={`rotate(${angle} 32 32)`}>
          <path d="M32 6 L37 22 L27 22 Z" strokeWidth={1.75} fill="currentColor" fillOpacity={0.08} />
        </g>
      ))}
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  );
}

// 2. Citadel — fortress wall with five merlons. Architectural, defensive.
function Citadel() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="miter" strokeLinecap="square">
      {/* Five merlons + crenellated top (single path) */}
      <path
        d="M8 30 V18 H14 V12 H22 V18 H28 V12 H36 V18 H42 V12 H50 V18 H56 V30"
        strokeWidth={2.25}
      />
      {/* Wall body */}
      <path d="M8 30 H56 V52 H8 Z" strokeWidth={2.25} />
      {/* Doorway */}
      <path d="M28 52 V40 H36 V52" strokeWidth={1.75} opacity={0.55} />
    </svg>
  );
}

// 3. Lock dial — circle with five radial pin marks. Vault metaphor.
function LockDial() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="32" cy="32" r="22" strokeWidth={2} />
      {/* Five pin marks, 72° apart, at the inscribed-circle */}
      {[
        { x1: 32, y1: 6, x2: 32, y2: 14 },
        { x1: 56.7, y1: 24, x2: 49, y2: 26.6 },
        { x1: 47.3, y1: 53, x2: 42.7, y2: 46.5 },
        { x1: 16.7, y1: 53, x2: 21.3, y2: 46.5 },
        { x1: 7.3, y1: 24, x2: 15, y2: 26.6 },
      ].map((p, i) => (
        <line key={i} {...p} strokeWidth={2} />
      ))}
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}

// 4. Aperture — five overlapping triangular blades like a camera shutter.
//    Reads as observation, focus, or a closing aperture.
function Aperture() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      {[0, 72, 144, 216, 288].map(angle => (
        <g key={angle} transform={`rotate(${angle} 32 32)`}>
          <path d="M32 12 L46 38 L18 38 Z" strokeWidth={1.5} fill="currentColor" fillOpacity={0.06} />
        </g>
      ))}
    </svg>
  );
}

// 5. Geometric P — bold monogram with sharp pentagonal angles in the bowl.
function MonogramP() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      <path
        d="M14 8 H40 L54 22 L40 36 H22 V56 H14 Z"
        strokeWidth={1}
        fillRule="evenodd"
      />
    </svg>
  );
}

// 6. Bastion — chevron-stacked silhouette of a layered fortification.
//    Five tiered wedges descending. Signals layered defense.
function Bastion() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      {/* Five descending chevrons, top tightest */}
      <path d="M32 6 L40 14 L24 14 Z" strokeWidth={1.75} fill="currentColor" fillOpacity={0.12} />
      <path d="M22 18 L42 18 L36 26 L28 26 Z" strokeWidth={1.75} fill="currentColor" fillOpacity={0.08} />
      <path d="M16 30 L48 30 L42 38 L22 38 Z" strokeWidth={1.75} fill="currentColor" fillOpacity={0.05} />
      <path d="M10 42 L54 42 L46 50 L18 50 Z" strokeWidth={1.75} fill="currentColor" fillOpacity={0.03} />
      <path d="M4 54 L60 54" strokeWidth={2.25} />
    </svg>
  );
}

// 7. Five-petal — nested arcs forming a pentagonal flower silhouette.
//    Soft but geometrically precise. Five-fold rotational symmetry.
function FivePetal() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      {[0, 72, 144, 216, 288].map(angle => (
        <g key={angle} transform={`rotate(${angle} 32 32)`}>
          <path d="M32 32 Q32 12 38 18 Q44 24 32 32" strokeWidth={1.75} />
        </g>
      ))}
      <circle cx="32" cy="32" r="2.5" fill="currentColor" />
    </svg>
  );
}

// 8. Crucible — a forge anvil silhouette. Plays on the "Forge" name.
function Crucible() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      {/* Anvil */}
      <path
        d="M10 26 H54 L48 32 H40 V38 H46 L52 50 H12 L18 38 H24 V32 H16 Z"
        strokeWidth={2}
      />
      {/* Five sparks above */}
      {[16, 26, 32, 38, 48].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 === 0 ? 14 : 18} r={1.5} fill="currentColor" />
      ))}
    </svg>
  );
}

const CONCEPTS: { id: string; name: string; desc: string; meaning: string; Component: () => React.ReactElement }[] = [
  {
    id: 'current',
    name: 'Current — Dual pentagon',
    desc: 'Outer pentagon + inverted inner pentagon.',
    meaning: 'The star is implicit in the triangular voids. Premium but still pentagon-led.',
    Component: CurrentDualPentagon,
  },
  {
    id: 'sentinels',
    name: '01 — Sentinels',
    desc: 'Five wedge blades radiating from a center hub.',
    meaning: 'Five guardians at posts. Pentagonal symmetry without a pentagon outline.',
    Component: Sentinels,
  },
  {
    id: 'citadel',
    name: '02 — Citadel',
    desc: 'Fortress wall with five merlons.',
    meaning: 'Architectural, defensive. The most literal security-firm metaphor.',
    Component: Citadel,
  },
  {
    id: 'lock',
    name: '03 — Lock dial',
    desc: 'Circle with five radial pin marks.',
    meaning: 'Vault / lock mechanism. Direct security signal. Five marks for the agents.',
    Component: LockDial,
  },
  {
    id: 'aperture',
    name: '04 — Aperture',
    desc: 'Five overlapping triangular blades, camera shutter geometry.',
    meaning: 'Observation, focus, scrutiny. Five blades closing on the contract.',
    Component: Aperture,
  },
  {
    id: 'p',
    name: '05 — Monogram P',
    desc: 'Geometric P with sharp pentagonal angles in the bowl.',
    meaning: 'Trail-of-Bits / OpenZeppelin register. A stamped letterform mark.',
    Component: MonogramP,
  },
  {
    id: 'bastion',
    name: '06 — Bastion',
    desc: 'Five tiered chevrons over a foundation line.',
    meaning: 'Layered defense. Five layers between the threat and the vault.',
    Component: Bastion,
  },
  {
    id: 'petal',
    name: '07 — Five-petal',
    desc: 'Five arcs forming a rotational flower silhouette.',
    meaning: 'Most organic option. Pentagonal symmetry with a softer line.',
    Component: FivePetal,
  },
  {
    id: 'crucible',
    name: '08 — Crucible',
    desc: 'Anvil with five sparks above.',
    meaning: 'Plays on the "Forge" name. Five sparks for the agents at work.',
    Component: Crucible,
  },
];

export default function LogoMockupsPage() {
  return (
    <div data-marketing="true">
      <MarketingHeader />
      <main>
        <section className="m-section m-section--first" style={{ paddingBottom: 32 }}>
          <div className="m-container">
            <div className="m-prose">
              <span className="m-eyebrow">Internal · logo concepts</span>
              <h1 className="m-h1" style={{ marginTop: 24, marginBottom: 24 }}>
                Eight directions, one wordmark.
              </h1>
              <p className="m-lede">
                Each concept is rendered at the same 80&nbsp;px size you&rsquo;ll see in
                the header, plus a 32&nbsp;px row beneath at the actual deployed size.
                All use <code>currentColor</code>, so they pick up the surface palette.
              </p>
              <p className="m-meta" style={{ marginTop: 16 }}>
                <Link href="/forge" style={{ color: 'var(--m-accent)', borderBottom: '1px solid currentColor' }}>
                  ← Back to forge
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="m-section" style={{ paddingTop: 24 }}>
          <div className="m-container">
            <div className="logo-grid">
              {CONCEPTS.map(c => {
                const C = c.Component;
                return (
                  <article key={c.id} className="logo-card">
                    <header className="logo-card-head">
                      <h3 className="logo-card-name">{c.name}</h3>
                    </header>
                    <div className="logo-card-stage logo-card-stage--lg">
                      <span style={{ width: 80, height: 80, display: 'inline-flex', color: 'var(--m-fg)' }}><C /></span>
                    </div>
                    <div className="logo-card-stage">
                      <div className="logo-card-row">
                        <span style={{ width: 32, height: 32, display: 'inline-flex', color: 'var(--m-fg)' }}><C /></span>
                        <span style={{ fontFamily: 'var(--m-font-display)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.025em' }}>
                          Pentagonal
                        </span>
                      </div>
                    </div>
                    <p className="logo-card-desc">{c.desc}</p>
                    <p className="logo-card-meaning">{c.meaning}</p>
                  </article>
                );
              })}
            </div>

            <p className="m-meta" style={{ marginTop: 48, textAlign: 'center' }}>
              Each concept is one path file change away. Tell me a number — or two to
              hybridise — and I&rsquo;ll wire it through forge + marketing + footer.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
