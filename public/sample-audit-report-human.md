# SentinelVault — Adversarial Security Review

**Pentagonal · Smart Contract Forge**
**Revision 14 · April 22, 2026**

---

## Cover sheet

| | |
|---|---|
| **Subject** | SentinelVault.sol — staking module |
| **Submitter** | Sentinel Labs Ltd. (redacted in this sample) |
| **Solidity** | 0.8.24 |
| **Network** | Base mainnet |
| **Lines reviewed** | 412 |
| **Compiled artefact** | 1 contract, 3 libraries |
| **Adversaries deployed** | 8 |
| **Rules applied** | 2,184 |
| **Security score** | 61 / 100 |
| **Risk profile** | High — three critical findings, two high |
| **Recommended action** | Do not deploy in current form. Apply consolidated remediation patch and re-run before exposing to user funds. |

---

## Abstract

This document is a sample of Pentagonal's human-readable audit format,
produced for technical reviewers, fund partners, and compliance teams who
read prose more readily than diff output. It contains the same findings
as the AI-readable format Pentagonal returns to autonomous agents over
x402, restated as narrative.

The reviewed module implements an ERC-4626 staking vault with
time-weighted rewards, a 1% performance fee, a seven-day unlock window
on withdrawals, and a guardian-pausable emergency exit path. It is
designed to launch on Base.

Pentagonal's red team — eight specialised attackers running in parallel,
each fluent in a single class of exploit — broke the contract in
**eleven places**. Three findings are critical and would, in their
current form, allow an attacker to drain the vault within a single
transaction once it holds non-trivial deposits. The remaining findings
range from rounding asymmetries that benefit the depositor at the
protocol's expense to gas-griefing surface on the harvest path.

A consolidated remediation patch is recommended before the contract is
exposed to user funds on mainnet. A re-run of the red team after the
suggested fixes were applied reduced the count to one informational
finding (a missing event emission on the keeper-rotation path) and
lifted the security score to 96 / 100.

---

## Risk profile

| Severity | Count | Cumulative loss potential |
|---|---|---|
| Critical | 3 | Full vault drain, single transaction |
| High | 2 | Reward dilution, dust-position bad debt socialised |
| Medium | 4 | Sandwich slippage, paused-state fee accrual, harvest DoS |
| Low / Informational | 2 | Operational visibility |
| **Total** | **11** | — |

The critical findings can be triggered by a single attacker, with no
flash loan required, at a cost of approximately $50 in mainnet gas. The
contract is therefore considered exploitable under live mainnet
conditions the moment its TVL crosses approximately $50,000 — the floor
at which an attacker's gas cost is recovered.

---

## Critical findings

### 1. Reentrant withdraw permits balance reuse before state update

**Reentrancy Hunter** identified, **Economic Exploit** confirmed.

The `withdraw` function on line 142 hands control to the recipient
through a low-level `call` before the caller's balance is decremented.
A contract recipient that re-enters `withdraw` from its `receive()`
function will pass the balance check on each pass — `bal[msg.sender]`
still reflects the pre-debit value — until the contract is empty. This
is the same vector that drained The DAO in 2016 and Cream Finance in
2021.

The exploit cost is one deployed contract and one transaction. No
flash loan, no oracle manipulation, no cross-protocol composition is
required.

**Remediation.** Invert to checks-effects-interactions: decrement
`bal[msg.sender]` before the external call. Apply OpenZeppelin
`ReentrancyGuard` as a secondary defence on every state-mutating
function that performs an external call. The unified diff is provided
in §6.

### 2. ERC-4626 first-deposit share inflation via direct token donation

**Economic Exploit** identified, **Overflow Saboteur** confirmed.

The deposit path on line 188 mints shares 1:1 against the deposited
asset when the vault is empty. An attacker deposits 1 wei of the
underlying as the first depositor and mints 1 share. They then transfer
1e21 tokens directly to the vault contract without going through
`deposit`. The next legitimate depositor passes `assets * 1 / 1e21` to
the share calculation — for any deposit below 1e21 underlying units,
shares round to zero. The attacker now owns 100% of supply against the
victim's deposit.

The donation cost is fully recovered when the attacker withdraws. The
victim's deposit is the realised gain. This is the same vector that
drained Hundred Finance in April 2023 for $7.4M.

**Remediation.** Mint a baseline of 1,000 dead shares to the zero
address on first deposit. This raises the floor cost of the donation
attack to a prohibitive level and is the OpenZeppelin v5 ERC4626
inflation-attack mitigation. Alternatively, require a minimum
first-deposit threshold and reject deposits where computed shares would
round to zero.

### 3. Reward-rate setter trusts oracle without staleness check

**Oracle Manipulator** identified, **Economic Exploit** confirmed.

The `setRewardRate` function on line 264 reads the latest round from a
Chainlink price feed without validating freshness. There are no checks
on `roundId`, `answeredInRound`, or `updatedAt`. On Base, where the
sequencer can pause for minutes during congestion or sequencer-down
events, `latestRoundData` returns the last successfully posted round —
potentially hours old.

A keeper running on a fixed cadence will pin the reward rate to a stale
price for the duration of the outage. Any user can then lock in that
stale rate by claiming. This bug is operationally distinct from active
manipulation: it surfaces during normal sequencer downtime, with no
attacker required.

**Remediation.** Validate `answeredInRound >= roundId`,
`updatedAt >= block.timestamp - HEARTBEAT`, and the L2 sequencer uptime
feed. On Base, gate the call on the sequencer feed returning answer
== 0 and an elapsed grace period of at least one hour since sequencer
restart.

---

## High findings

### 4. Harvest reward calculation reads in-block LP balance

**Flash Loan Attacker** identified.

The `harvest` function on line 312 computes reward shares against the
contract's current LP balance, which is manipulable for a single block
via flash loan. An attacker flash-borrows the LP token, calls `harvest`
to claim a disproportionate reward, and repays the flash loan within
the same transaction. The cost of attack is the flash-loan fee on the
temporarily inflated position — typically 0.05% to 0.09% of the loan.

**Remediation.** Snapshot LP balance at deposit-time, or require a
time-weighted average over the previous _n_ blocks. Alternatively,
require harvest to be called by accounts holding a minimum stake
duration.

### 5. Liquidation discount strands undercollateralised dust positions

**Economic Exploit** identified.

The liquidation bonus paid to keepers is a flat 5% of seized
collateral. Under positions where seized collateral falls below
approximately five times the gas-cost floor, no keeper liquidates
because the bonus does not cover the gas. Such positions accumulate
bad debt that is socialised across remaining stakers on the next
harvest.

**Remediation.** Implement a tiered liquidation bonus that scales with
position size, with a floor that always covers gas plus a minimum
profit margin. Alternatively, batch dust liquidations into
keeper-callable sweeps that pay a single bonus across many positions.

---

## Medium findings

The medium tier comprises four findings: a missing slippage parameter
on the emergency-exit swap path (sandwich-trivial), an initialiser
that gates on a mutable storage check rather than the OpenZeppelin
`initializer` modifier (re-entry possible after a future upgrade),
fee accrual that continues during paused state (charging depositors
for unavailable service), and an unbounded loop over registered
reward tokens (gas-griefable into a harvest DoS).

Each is enumerated in §5 with line numbers, exploit narrative, and
remediation.

---

## Low / informational

Two findings: a missing event emission on `setKeeper` (operational
visibility — keeper rotation cannot be detected by off-chain monitors
without state polling), and three public constants that could
reasonably be declared `immutable` if they are intended to be
parameterised at deployment.

---

## Methodology summary

Eight specialised attackers ran in parallel against the supplied
artefact. Each was briefed against the historical record of how its
vulnerability class has been used to drain real protocols. Findings
unique to one attacker were flagged for human review; findings
confirmed by two or more were escalated and annotated with
cross-attribution.

Severity was graded by approximate exploit cost on Base mainnet, not
by an arbitrary critical / high / medium ladder. The full briefing
each adversary operated from is published at
[https://pentagonal.ai/methodology](https://pentagonal.ai/methodology).

The eight adversaries:

1. **Reentrancy Hunter** — external-call ordering, cross-function
   reentry, read-only reentrancy, hook-based re-entry.
2. **Flash Loan Attacker** — single-block manipulation of price feeds,
   governance, and reward accounting.
3. **Access Control Prober** — missing modifiers, initializer reentry,
   proxy admin escalation, unrenounced ownership.
4. **Overflow Saboteur** — unchecked blocks, fixed-point precision
   loss, division ordering, casts.
5. **Oracle Manipulator** — single-source feeds, stale rounds, TWAP
   selection, sequencer-down handling.
6. **MEV Predator** — sandwich exposure, slippage parameters, missing
   commit-reveal, order-of-execution dependence.
7. **Economic Exploit** — donation attacks, share inflation,
   fee-on-transfer asymmetry, ERC-4626 rounding.
8. **Gas Griefer** — unbounded loops, refund-revert vectors,
   storage-layout DoS, cross-chain OOM.

---

## Disclaimer

This sample report describes findings on a redacted contract derived
from a real audit. Names, addresses, and identifying details have been
changed. The findings, code patterns, exploit narratives, and
remediation guidance are preserved as-delivered. Pentagonal's
adversarial review is a defensive engineering tool; it does not
constitute a financial or legal opinion, and findings are limited to
the artefact submitted. Off-chain dependencies, governance keys, and
operational practices are out of scope.

---

*Pentagonal · Adversarial smart contract review · Eight attackers, one
report, every contract.*
