// ─── Pentagonal Logo ─────────────────────────────────────
// Monogram P with a pentagonal-faceted bowl shoulder.
// The five-sided geometry lives in the bowl corner — the
// 'P' silhouette is the brand, the pentagonal facet is the
// hidden meaning. No pentagram. No occult cargo.
//
// Filled mark; uses currentColor so it inherits parent CSS.

type Props = {
  size?: number;
  className?: string;
};

// Outer P silhouette + bowl-interior cutout.
// Even-odd fill rule cuts the hole.
//
// Coordinates in 64×64 viewBox:
//   Stem:        x 14–22, y 8–56
//   Bowl outer:  apex at (54, 22) — the pentagonal facet
//   Bowl inner:  apex at (47, 22) — same facet, scaled in
const P_PATH = [
  // outer silhouette (clockwise from top-left)
  'M14 8',
  'H40',
  'L54 22',
  'L40 36',
  'H22',
  'V56',
  'H14',
  'Z',
  // bowl-interior cutout (counter-clockwise — even-odd punches the hole)
  'M22 14',
  'H38',
  'L47 22',
  'L38 30',
  'H22',
  'Z',
].join(' ');

export function PentagonLogo({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d={P_PATH} fillRule="evenodd" />
    </svg>
  );
}

// Compact mark used in the forge header, marketing nav, and footer.
// Identical geometry — same SVG, smaller default size.
export function PentagonMark({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d={P_PATH} fillRule="evenodd" />
    </svg>
  );
}
