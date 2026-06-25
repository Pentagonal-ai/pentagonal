// Pentagonal Sentinel — Quantum exposure agent (Chunk 2), the "9th attacker".
// HONEST framing: this is post-quantum *risk analytics / crypto-agility*, NOT "quantum-proof".
// The only quantum-vulnerable primitive that actually lives in EVM contracts is elliptic-curve
// crypto (secp256k1 via ecrecover/ECDSA, BN254 pairings). Hashing (keccak256) is quantum-resistant,
// so we deliberately do NOT flag Merkle/keccak usage.

export type QuantumFinding = {
  primitive: string;
  title: string;
  detail: string;
  recommendation: string;
};

export type QuantumResult = {
  exposed: boolean;
  severity: 'none' | 'low' | 'medium';
  primitives: string[];
  findings: QuantumFinding[];
  note: string;
};

type Rule = { test: RegExp; primitive: string; title: string; detail: string; recommendation: string };

const RULES: Rule[] = [
  {
    test: /\becrecover\s*\(/,
    primitive: 'secp256k1 (ecrecover)',
    title: 'On-chain ECDSA signature recovery (ecrecover)',
    detail:
      'The contract verifies secp256k1 signatures on-chain via ecrecover. secp256k1 is an elliptic-curve scheme that a cryptographically-relevant quantum computer could break by recovering private keys from exposed public keys, allowing signature forgery.',
    recommendation:
      'Build a crypto-agility path: route signature checks through an upgradeable validator (EIP-1271 / account abstraction) so the scheme can be swapped to a post-quantum signature later. Avoid hardcoding ECDSA assumptions in immutable logic.',
  },
  {
    test: /\bECDSA\s*\.\s*(recover|tryRecover)\s*\(|using\s+ECDSA\b/,
    primitive: 'secp256k1 (ECDSA lib)',
    title: 'ECDSA library signature verification',
    detail:
      'Uses an ECDSA (secp256k1) library to verify signatures. Same forward quantum risk as raw ecrecover.',
    recommendation:
      'Keep signature verification behind an upgradeable boundary so the curve/scheme can migrate to a PQC algorithm without redeploying core logic.',
  },
  {
    test: /\bpermit\s*\(/,
    primitive: 'EIP-2612 permit',
    title: 'EIP-2612 / EIP-712 signature-based approvals (permit)',
    detail:
      'Gasless approvals (permit) authorize transfers with an off-chain ECDSA signature. The authorization surface depends on secp256k1.',
    recommendation:
      'Track NIST PQC standardization; design the approval flow so a future signature scheme can be added alongside ECDSA rather than replacing an immutable verifier.',
  },
  {
    test: /\bisValidSignature\s*\(/,
    primitive: 'EIP-1271',
    title: 'EIP-1271 smart-contract signature checks',
    detail:
      'Smart-contract signature validation (EIP-1271) typically resolves to ECDSA underneath. This is actually the right place to introduce crypto-agility.',
    recommendation:
      'Good news: EIP-1271 is the natural seam for upgrading to a post-quantum scheme. Ensure the validator is upgradeable/swappable.',
  },
  {
    test: /\b(ecpairing|ecadd|ecmul|bn256|bn254|pairing\s*\()\b/i,
    primitive: 'BN254 pairing',
    title: 'BN254 elliptic-curve pairing (BLS / zk verification)',
    detail:
      'Uses BN254 pairing precompiles (BLS signatures or zk-SNARK verification). Pairing-based EC crypto is also quantum-vulnerable.',
    recommendation:
      'For long-lived verifiers, plan for PQC-friendly proof systems (e.g., hash-based STARKs) as a migration target.',
  },
];

/** Analyze flattened Solidity source for quantum-vulnerable cryptographic primitives. */
export function analyzeQuantumExposure(source: string): QuantumResult {
  const src = source || '';
  const findings: QuantumFinding[] = [];
  for (const r of RULES) {
    if (r.test.test(src)) {
      findings.push({ primitive: r.primitive, title: r.title, detail: r.detail, recommendation: r.recommendation });
    }
  }
  const primitives = [...new Set(findings.map((f) => f.primitive))];
  const hasBN254 = primitives.some((p) => p.includes('BN254'));
  const severity: QuantumResult['severity'] =
    findings.length === 0 ? 'none' : findings.length >= 2 || hasBN254 ? 'medium' : 'low';

  return {
    exposed: findings.length > 0,
    severity,
    primitives,
    findings,
    note:
      findings.length === 0
        ? 'No quantum-vulnerable primitives detected. The contract relies on keccak256 hashing, which is quantum-resistant. This is forward-looking analytics, not "quantum-proof" certification.'
        : 'Forward risk only — not exploitable today (no cryptographically-relevant quantum computer exists). This flags where crypto-agility matters if/when one does.',
  };
}

const ETHERSCAN_CHAINS: Record<string, number> = {
  ethereum: 1, polygon: 137, arbitrum: 42161, base: 8453,
  optimism: 10, bsc: 56, avalanche: 43114,
};

/** Fetch verified Solidity source via Etherscan V2 (EVM only). Returns null if unavailable. */
export async function fetchVerifiedSource(address: string, chain: string): Promise<string | null> {
  const chainId = ETHERSCAN_CHAINS[chain];
  const key = process.env.ETHERSCAN_API_KEY;
  if (!chainId || !key) return null;
  try {
    const r = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${key}`,
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { status?: string; result?: { SourceCode?: string }[] };
    const code = d?.result?.[0]?.SourceCode;
    return code && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}
