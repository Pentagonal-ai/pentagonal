// ─── Known launchpads ────────────────────────────────────
// Tokens deployed by these factories share an identical implementation
// template. We don't need to re-audit each one; we serve a cached
// audit for the template instead.
//
// To add a launchpad:
//   1. Identify the factory / token-manager contract address
//   2. Add an entry below
//   3. Drop the cached audit at /public/<slug>-template-audit.md

export type Launchpad = {
  /** stable id for routing the cached audit + UI matching */
  id: string;
  /** display name */
  name: string;
  /** launchpad website */
  url: string;
  /** chain id this launchpad runs on */
  chainId: number;
  /** chain explorer for the factory contract */
  explorerUrl: string;
  /** the on-chain contract that creates / manages tokens for this launchpad. */
  factoryAddress: string;
  /** path to the cached template audit served from /public */
  cachedAuditPath: string;
  /** short blurb shown in the UI badge */
  blurb: string;
};

export const LAUNCHPADS: Launchpad[] = [
  {
    id: 'four-meme',
    name: 'Four.meme',
    url: 'https://four.meme',
    chainId: 56,
    explorerUrl: 'https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b',
    factoryAddress: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
    cachedAuditPath: '/four-meme-template-audit.md',
    blurb: 'BNB Chain memecoin launchpad. All tokens share an identical bonding-curve template.',
  },
];

export function findLaunchpadByCreator(creator: string, chainId: number): Launchpad | null {
  if (!creator) return null;
  const c = creator.toLowerCase();
  return (
    LAUNCHPADS.find(
      l => l.chainId === chainId && l.factoryAddress.toLowerCase() === c,
    ) ?? null
  );
}

export function findLaunchpadById(id: string): Launchpad | null {
  return LAUNCHPADS.find(l => l.id === id) ?? null;
}
