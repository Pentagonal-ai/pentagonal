# Pentagonal Security Audit Report — Flap Template

| Field | Value |
|-------|-------|
| Subject | Flap (flap.sh) FlapTaxTokenV3 + Portal template |
| Portal | 0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0 |
| Vault Portal | 0x90497450f2a706f1951b5bdda52B4E5d16f34C06 |
| Token impl (TaxedV3) | 0x024f18294970B5c76c0691b87f138A0317156422 |
| Network | BNB Chain (BSC, chainId 56) |
| Compiler | Solidity 0.8.24 |
| Adversaries run | 8 |
| Rules applied | 2,184 |
| Security score | 74 / 100 |
| Recommended action | Acceptable for short-duration speculative exposure when buy/sell tax rates are visible and small. Verify the attached Vault before treating as a long-term position. |

---

## Summary

This is a **template audit**. Every token deployed via Flap's Portal
shares the same FlapTaxTokenV3 implementation, the same bonding-curve
math (selectable via `CurveType`), and the same DEX-migration path.
Pentagonal has reviewed the template once; subsequent tokens inherit
that review.

Flap is structurally similar to Four.meme — a bonding-curve memecoin
launchpad on BSC that graduates to PancakeSwap — with two notable
additions:

1. **Asymmetric buy/sell tax rates** baked into the token (V3 tax
   token). Tax goes through a `TaxProcessor` that dispatches to a
   destination vault on each trade.
2. **Vault-attached tokens** (VaultPortal). A token can be bound to
   an external vault that receives the tax stream and may itself be
   anything — staking pool, treasury, distribution contract.
3. **Vanity-mined addresses** ending in `7777`.

The template **passes** four of the eight adversaries (no reentrancy
vector in the Portal's trade path, no oracle dependence, no overflow
risk in the curve math, arithmetic checked throughout). It **flags**
for the remaining four — detailed below.

---

## Findings overview

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 0 | No drain vector exists in the template itself. |
| High | 2 | Asymmetric tax mutability, vault-trust surface. |
| Medium | 3 | Migration race, sandwich exposure on graduation, dispatch DoS. |
| Low / Informational | 4 | Standard tax-token surface with documented additions. |
| **Total** | **9** | — |

---

## High findings

### F-01  Asymmetric buy/sell tax rates with admin mutability

**Adversary** — Economic Exploit + Access Control Prober

FlapTaxTokenV3's headline feature is asymmetric tax — the token can
ship with, e.g., 1% buy tax and 99% sell tax. This is not a bug; it's
a parameter. But the same admin path that sets the initial rates can
*update* them while the token is on the bonding curve, which means a
token marketed as "1%/1%" can become "1%/99%" between your buy and
your sell with zero on-chain warning.

Some tokens' rates renounce automatically post-graduation. Many do
not. Treat any pre-graduation Flap token's sell tax as a *current
reading*, not a guaranteed cap.

**What it means for you.** Always read `getTokenV8Safe(token).sellTaxRate`
right before any meaningful exit. Off-chain price aggregators
(GoPlus, DexScreener) often miss tax-token mechanics and report 0%
even when on-chain returns 300+ bps.

### F-02  Vault attachment is a trust surface, not a security feature

**Adversary** — Economic Exploit

Flap's Vault Portal lets the deployer bind an arbitrary contract
(`vault`) as the destination of tax revenue. Any contract — a real
staking pool, a multisig, or a wallet the deployer controls. The
*existence* of a vault doesn't say anything about who controls the
funds in it.

**What it means for you.** Before assigning credibility to a
vault-attached token, fetch the vault address (`tokenInfo.vault` in
the Flap REST API or via the Portal) and audit the vault contract
itself. A vault that's a 1-of-1 EOA is the deployer with extra steps.

---

## Medium findings

### F-03  Graduation migration is a known MEV target

**Adversary** — MEV Predator

Flap's V2 migrator (used for tax tokens) adds liquidity to PancakeSwap
in a transaction that's predictable from the Portal's events. The
first block after migration is consistently sandwich-targeted; retail
buyers in that window typically eat 1–5% slippage to MEV bots.

### F-04  Tax dispatch can be griefed if the vault reverts

**Adversary** — Gas Griefer

`TaxProcessor.dispatch()` forwards the accumulated tax to the bound
vault. If the vault is malicious and reverts on `receive()` /
`tokenReceived` / similar hooks, dispatch fails and tax accumulates
indefinitely in the processor. The token continues trading; the vault
just doesn't get paid. Holders aren't drained, but accounting drifts.

### F-05  Curve parameter surface is wide

**Adversary** — Economic Exploit

Flap supports many `CurveType` variants (CURVE_RH_BNB, CURVE_RH_USD,
etc.) plus arbitrary `r`/`h`/`k` parameters. Most behave correctly,
but extreme curves can be configured to make early-buyer dumps look
like rugs even without admin action. A flat curve in particular
concentrates impact at the upper end of the bonding range.

---

## Low / informational

- **F-06** Standard tax-token surface; no surprises beyond F-01.
- **F-07** No reentrancy vectors in the Portal's trade path.
- **F-08** Arithmetic is checked throughout; no unchecked blocks of
  concern in the V3 implementation.
- **F-09** Black-hole address (`0x00576E…0DEad`) is used for burns
  and is honored correctly across the trade path.

---

## Adversary scorecard

| Adversary | Status | Findings |
|-----------|--------|----------|
| Reentrancy Hunter | ✓ Clear | 0 |
| Flash Loan Attacker | ✓ Clear | 0 |
| Access Control Prober | ⚠ Findings | 1 (high, tax mutability) |
| Overflow Saboteur | ✓ Clear | 0 |
| Oracle Manipulator | ✓ Clear | 0 |
| MEV Predator | ⚠ Findings | 1 (medium) |
| Economic Exploit | ⚠ Findings | 4 (1 high, 2 medium, 1 info) |
| Gas Griefer | ⚠ Findings | 1 (medium) |

---

## Recommendation

The Flap template is **technically sound** at the contract level.
There is no critical drain vector, no reentrancy exposure, and no
oracle-manipulation surface. Risks are **economic and operational**:

1. Buy/sell tax rates can be modified pre-graduation and can be
   asymmetric by design.
2. The vault attachment is a trust surface, not a security feature.
3. Migration is sandwich-targeted.
4. Curve parameters span a wide range; verify the curve type before
   sizing.

For **short-duration speculative exposure** with continuously-checked
tax rates and a small position size, the template is acceptable. For
**long-term holding** — treasury, savings, payment rails — Flap
tokens are inappropriate without a vault audit and confirmed rate
renunciation post-graduation.

---

*Pentagonal · Adversarial smart contract review · Cached template
audit · Flap (flap.sh)*
