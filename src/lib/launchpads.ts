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
  /** path to the branded PDF cached audit served from /public (humans). */
  cachedAuditPath: string;
  /** path to the markdown cached audit served from /public (agents). */
  cachedAuditMarkdownPath: string;
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
    cachedAuditPath: '/four-meme-template-audit.pdf',
    cachedAuditMarkdownPath: '/four-meme-template-audit.md',
    blurb: 'BNB Chain memecoin launchpad. All tokens share an identical bonding-curve template (vanity suffix 4444).',
  },
  {
    id: 'flap',
    name: 'Flap',
    url: 'https://flap.sh',
    chainId: 56,
    explorerUrl: 'https://bscscan.com/address/0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0',
    factoryAddress: '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0',
    cachedAuditPath: '/flap-template-audit.pdf',
    cachedAuditMarkdownPath: '/flap-template-audit.md',
    blurb: 'BNB Chain tax-token launchpad with vault-attached tokens (vanity suffix 7777). Tokens trade on a Flap bonding curve before migrating to PancakeSwap.',
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
