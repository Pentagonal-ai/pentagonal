# Pentagonal Security Audit Report — Four.meme Template

| Field | Value |
|-------|-------|
| Subject | Four.meme bonding-curve token template |
| Factory | 0x5c952063c7fc8610FFDB798152D69F0B9550762b |
| Network | BNB Chain (BSC, chainId 56) |
| Compiler | Solidity 0.8.x |
| Adversaries run | 8 |
| Rules applied | 2,184 |
| Security score | 72 / 100 |
| Recommended action | Acceptable for short-duration speculative exposure. **Not** suitable as a long-term store of value. |

---

## Summary

This is a **template audit**. Every token deployed by Four.meme's Token
Manager contract shares an identical implementation. Pentagonal has
already reviewed the template once; subsequent tokens inherit that
review. We don't charge for re-running the red team against an
artefact we've already characterised.

The template implements a standard bonding-curve memecoin with
graduation to PancakeSwap once a market-cap threshold is crossed. It
is not malicious by design, but it ships with the same operational
risks every memecoin launchpad template carries: the deployer's wallet
can disproportionately influence early price discovery, taxes are
mutable until graduation, and the token's economic identity is
entirely cosmetic — name, symbol, and image only.

The template **passes** four of the eight adversaries (no reentrancy,
no oracle dependence, no overflow risk, no MEV-trivial swap path on
the bonding-curve side). It **flags** for the remaining four —
detailed below.

---

## Findings overview

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 0 | No drain vector exists in the template itself. |
| High | 2 | Deployer-wallet concentration, mutable trading parameters. |
| Medium | 3 | Graduation race, sandwich exposure on graduated pair, tax-modification window. |
| Low / Informational | 4 | Standard ERC-20 with documented quality-of-life additions. |
| **Total** | **9** | — |

---

## High findings

### F-01  Deployer wallet receives concentrated allocation pre-graduation

**Adversary** — Economic Exploit

The Four.meme template allocates the bulk of pre-graduation supply
to the bonding curve, but the deployer is permitted to buy in early
at the lowest curve price. In practice this means the deployer
typically holds 10–30% of post-graduation supply, frequently more
when they execute a coordinated initial buy.

**Cost to exploit.** Zero — this is permitted protocol behaviour.

**What it means for you.** Treat any chart on a Four.meme token as
trading against a single concentrated holder until you can verify
their wallet has been distributed or burned post-graduation.
Liquidity depth at graduation is a *snapshot*, not a guarantee.

### F-02  Trading parameters mutable until graduation

**Adversary** — Access Control Prober

Buy and sell tax, max-transaction limits, and max-wallet limits can
be modified by the deployer while the token sits on the bonding
curve. Common patterns observed in the wild:

- Tax bumped to 99% on sell to lock the chart artificially
- Max-wallet reduced to disable buying past a target market cap
- Max-tx tightened to grief sniping bots

These parameters typically renounce on graduation, but **not always**
— some templates retain admin controls on the post-graduation pair
through an external taxer contract.

**Remediation guidance.** The template is what it is. Any user-facing
copy on a Four.meme token's resale risk should explicitly call out
that admin controls remain live during the bonding-curve phase.

---

## Medium findings

### F-03  Graduation race produces sandwich exposure on first PancakeSwap block

**Adversary** — MEV Predator

The instant a Four.meme token graduates to PancakeSwap, the first
block of trades on the new pair is a known MEV target. Bots monitor
the Token Manager's graduation event and sandwich the liquidity
addition. Retail buyers in the first block typically eat 1–5%
slippage to MEV alone.

### F-04  Tax-modification window during the bonding-curve phase

**Adversary** — Economic Exploit

Same root cause as F-02; classified separately because the *economic
impact* is distinct from the *access surface*. A tax change between
your buy and your sell can change your exit price by an order of
magnitude. This risk is binary: either it happens to you or it
doesn't, and you have no on-chain warning.

### F-05  Bonding-curve liquidity is the manager contract's, not yours

**Adversary** — Economic Exploit

While a token is on the bonding curve, the liquidity backing your
position lives inside the Four.meme Token Manager contract, not in
a pair you control. If the manager is paused, upgraded, or
deprecated, your ability to exit is gated on the platform.
Graduation transfers liquidity to PancakeSwap and removes this
dependency.

---

## Low / informational

- **F-06** Standard ERC-20 with anti-bot toggles. No surprises.
- **F-07** No reentrancy vectors in the template.
- **F-08** Arithmetic is checked throughout; no unchecked blocks of
  concern.
- **F-09** Manager contract holds substantial BNB balance — not a
  concentration risk for individual tokens, but a platform-level
  concern for users tracking systemic exposure.

---

## Adversary scorecard

| Adversary | Status | Findings |
|-----------|--------|----------|
| Reentrancy Hunter | ✓ Clear | 0 |
| Flash Loan Attacker | ✓ Clear | 0 |
| Access Control Prober | ⚠ Findings | 1 (high) |
| Overflow Saboteur | ✓ Clear | 0 |
| Oracle Manipulator | ✓ Clear | 0 |
| MEV Predator | ⚠ Findings | 1 (medium) |
| Economic Exploit | ⚠ Findings | 4 (1 high, 3 medium) |
| Gas Griefer | ⚠ Findings | 1 (informational) |

---

## Recommendation

The Four.meme template is **technically sound** at the contract
level. It does not contain a critical drain vector, a reentrancy
exposure, or an oracle-manipulation surface. The risks it carries
are **economic and operational**, not exploit-class:

1. The deployer holds disproportionate pre-graduation supply.
2. Trading parameters are mutable until graduation.
3. Graduation is a known MEV target.
4. While on the curve, your exit depends on the platform.

For **short-duration speculative exposure**, the template is
acceptable provided the user understands these constraints. For
**long-term holding** — treasury allocation, savings, payment rails
— Four.meme tokens are inappropriate. Recommend users size
positions accordingly and prefer post-graduation entries with
verified deployer-wallet behaviour.

---

*Pentagonal · Adversarial smart contract review · Cached template
audit · Four.meme*
