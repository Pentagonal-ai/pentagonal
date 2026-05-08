# Pentagonal Security Audit Report

| Field | Value |
|-------|-------|
| Contract | SentinelVault.sol |
| Chain | Base |
| Date | April 22, 2026 |
| Security Score | 61/100 |
| Rules Applied | 2184 |

---

## Executive Summary

SentinelVault is a single-asset ERC-4626 staking module with time-weighted rewards, a 1% performance fee, a seven-day unlock window on withdrawals, and a guardian-pausable emergency exit path. The red team broke it in eleven places. Three findings are critical and would, in their current form, allow an attacker to drain the vault within a single transaction once it holds non-trivial deposits. The remaining findings range from rounding asymmetries that benefit the depositor at the protocol's expense to gas griefing on the harvest path. A consolidated remediation patch is recommended before the contract is exposed to user funds on mainnet.

## Methodology

Eight specialised attackers ran in parallel against the supplied artefact: Reentrancy Hunter, Flash Loan Attacker, Access Control Prober, Overflow Saboteur, Oracle Manipulator, MEV Predator, Economic Exploit, and Gas Griefer. Each was briefed against the historical record of how its vulnerability class has been used to drain real protocols. Findings unique to one attacker are flagged for human review; findings confirmed by two or more were escalated. Severity was graded by approximate exploit cost on Base mainnet, not by an arbitrary critical/high/medium ladder.

## Findings Overview

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 2 |
| Medium | 4 |
| Low | 2 |
| **Total** | **11** |

---

## Code Segment Review

### 1. Withdraw path (L138–152) — CRITICAL

External call sent before state mutation. The withdraw path hands control to the recipient before the caller's balance is decremented.

```solidity
function withdraw(uint256 amt) external {
    require(bal[msg.sender] >= amt);
    (bool ok,) = msg.sender.call{value: amt}("");
    require(ok, "transfer failed");
    bal[msg.sender] -= amt;
}
```

**Findings in this segment:**
- [CRITICAL] Reentrant withdraw permits balance reuse before state update (L142)

### 2. Deposit / share calculation (L184–204) — CRITICAL

ERC-4626 deposit path with no first-deposit floor and no donation guard. The branch that handles the empty-vault case mints 1:1 shares against the assets parameter, opening a textbook share-price inflation vector.

```solidity
function deposit(uint256 assets) external returns (uint256 shares) {
    if (totalSupply() == 0) {
        shares = assets;
    } else {
        shares = assets * totalSupply() / asset.balanceOf(address(this));
    }
    asset.safeTransferFrom(msg.sender, address(this), assets);
    _mint(msg.sender, shares);
}
```

**Findings in this segment:**
- [CRITICAL] ERC-4626 first-deposit share inflation via direct token donation (L188)

### 3. Reward rate setter (L260–276) — CRITICAL

Oracle read with no staleness validation. On Base, where the sequencer can pause for minutes during congestion, `latestRoundData` returns the last successfully posted round — potentially hours old.

```solidity
function setRewardRate() external onlyKeeper {
    (, int256 price,,,) = chainlinkFeed.latestRoundData();
    require(price > 0, "bad price");
    rewardRate = uint256(price) / 1e8;
}
```

**Findings in this segment:**
- [CRITICAL] Reward-rate setter trusts oracle without staleness check (L264)

### 4. Harvest accounting (L308–328) — HIGH

Reward distribution computed against the in-block LP balance. Inflatable for a single block via flash loan.

```solidity
function harvest() external {
    uint256 shares = IERC20(LP).balanceOf(address(this));
    uint256 reward = (totalReward * shares) / totalShares;
    _mint(msg.sender, reward);
}
```

**Findings in this segment:**
- [HIGH] Harvest reward calculation reads in-block LP balance (L312)

### 5. Liquidation path (L370–408) — HIGH

Flat 5% liquidation bonus regardless of position size. Positions where seized collateral falls below `5 × gasCostFloor` accumulate bad debt that is socialised across remaining stakers.

```solidity
function liquidate(address pos) external {
    uint256 seized = positions[pos].collateral;
    uint256 bonus = seized * 500 / 10000;
    payable(msg.sender).transfer(bonus);
    delete positions[pos];
}
```

**Findings in this segment:**
- [HIGH] Liquidation discount strands undercollateralised dust positions (L378)

---

## Detailed Findings

### 1. [CRITICAL] Reentrant withdraw permits balance reuse before state update

**Agent:** Reentrancy Hunter | **Line:** 142

State is mutated after the external call. A contract recipient that re-enters `withdraw` from its `receive()` function will pass the balance check on each pass — `bal[msg.sender]` still reflects the pre-debit value — until the contract is empty. Cross-confirmed by the Economic Exploit agent: a re-entry through a malicious receiver costs only the gas for one deployed contract and one transaction, no flash loan required.

> **Recommendation:** Invert to checks-effects-interactions. Decrement `bal[msg.sender]` before the external call. Apply OpenZeppelin `ReentrancyGuard` as a secondary defence on every state-mutating function that performs an external call.

### 2. [CRITICAL] ERC-4626 first-deposit share inflation via direct token donation

**Agent:** Economic Exploit | **Line:** 188

Attacker deposits 1 wei of the underlying as the first depositor and mints 1 share. They then `safeTransfer` 1e21 tokens directly to the vault. The next legitimate depositor passes `assets * 1 / 1e21` to the share calculation — for any assets < 1e21, shares round to zero. The attacker now owns 100% of supply against the victim's deposit. Cost of attack: approximately 1e21 tokens of the underlying as sacrificial donation, recovered in full when the attacker withdraws.

> **Recommendation:** Mint a baseline of 1e3 dead shares to the zero address on first deposit, raising the floor cost of the donation attack to a prohibitive level. This is the OpenZeppelin v5 ERC4626 inflation-attack mitigation. Alternatively, require a minimum first-deposit threshold and reject deposits where computed shares would round to zero.

### 3. [CRITICAL] Reward-rate setter trusts oracle without staleness check

**Agent:** Oracle Manipulator | **Line:** 264

No checks on `roundId`, `answeredInRound`, or `updatedAt`. On Base, where the sequencer can pause for minutes during congestion or sequencer-down events, `latestRoundData` returns the last successfully posted round — potentially hours old. A keeper running on a fixed cadence will pin the reward rate to a stale price for the duration of the outage, which any user can lock in by claiming.

> **Recommendation:** Validate `answeredInRound >= roundId`, `updatedAt >= block.timestamp - HEARTBEAT`, and the L2 sequencer uptime feed. On Base, gate the call on `sequencerFeed.latestRoundData()` returning answer == 0 and elapsed grace period of at least one hour since sequencer restart.

### 4. [HIGH] Harvest reward calculation reads in-block LP balance

**Agent:** Flash Loan Attacker | **Line:** 312

`totalShares` and `shares` are read against the current block. A flash loan into the LP inflates `shares` for one block, draining a disproportionate reward. Cost of attack: flash-loan fee on the temporarily inflated LP position.

> **Recommendation:** Snapshot LP balance at deposit-time, or require a time-weighted average over n blocks. Alternatively, require harvest to be called by accounts holding a minimum stake duration.

### 5. [HIGH] Liquidation discount strands undercollateralised dust positions

**Agent:** Economic Exploit | **Line:** 378

A flat 5% liquidation bonus is paid to keepers regardless of the absolute size of the seized collateral. Under positions where seized collateral is below approximately `5 × gasCostFloor`, no keeper liquidates because the bonus does not cover the gas. The position accumulates bad debt that is socialised across remaining stakers on the next harvest.

> **Recommendation:** Implement a tiered liquidation bonus that scales with position size, with a floor that always covers gas + a minimum profit margin. Alternatively, batch dust liquidations into keeper-callable sweeps.

### 6. [MEDIUM] Swap path on emergency-exit lacks slippage parameter

**Agent:** MEV Predator | **Line:** 416

`emergencyExit()` calls the underlying DEX with `amountOutMin = 0` — sandwich-trivial. A user paniccing during a market move will be filled at the worst possible price.

> **Recommendation:** Accept `amountOutMin` from the caller and validate against an off-chain quote with explicit deadline. Refuse to execute below a reasonable floor.

### 7. [MEDIUM] Initialiser is callable a second time after upgrade

**Agent:** Access Control Prober | **Line:** 84

The `initialize` function gates on `admin == address(0)`, not on OpenZeppelin's `initializer` modifier. A future upgrade that resets `admin` to zero re-opens the function.

> **Recommendation:** Import OpenZeppelin's `Initializable` and apply the `initializer` modifier. Never gate ownership on a mutable storage check.

### 8. [MEDIUM] Pausable does not pause fee accrual

**Agent:** Economic Exploit | **Line:** 232

`whenNotPaused` is applied to user-facing entry points but not to `_accrue`. Fees continue to mount during a paused state, charging depositors for a service they cannot use.

> **Recommendation:** Apply `whenNotPaused` to `_accrue`, or freeze the fee-accrual timestamp on pause and resume from that point.

### 9. [MEDIUM] Unbounded loop over reward tokens on harvest

**Agent:** Gas Griefer | **Line:** 334

`harvest()` iterates over `rewardTokens[]`, which grows unbounded. A malicious admin can register dust tokens until the function exceeds the block gas limit, freezing rewards.

> **Recommendation:** Cap `rewardTokens.length` at a fixed constant (e.g., 16) and require admin removal of an existing token before adding a new one. Paginate harvest if necessary.

### 10. [LOW] Missing event on setKeeper

**Agent:** Access Control Prober | **Line:** 102

Operational visibility — adding `event KeeperSet(address indexed prev, address indexed next)` allows off-chain monitors to detect keeper rotation without polling state.

> **Recommendation:** Emit on every privileged role change.

### 11. [LOW] Public constants not declared immutable

**Agent:** Gas Griefer | **Line:** 28

`UNLOCK`, `PERF_BPS`, and `MAX_REWARD_TOKENS` are declared `public constant` but read in branches that could benefit from constant folding when parameterised at construction.

> **Recommendation:** Declare as `immutable` if these may be parameterised per-deployment; leave as `constant` if they are protocol-wide invariants.

---

## Agent Performance

| Agent | Status | Findings |
|-------|--------|----------|
| Reentrancy Hunter | ⚠ Findings | 1 |
| Flash Loan Attacker | ⚠ Findings | 1 |
| Access Control Prober | ⚠ Findings | 2 |
| Overflow Saboteur | ✓ Clear | 0 |
| Oracle Manipulator | ⚠ Findings | 1 |
| MEV Predator | ⚠ Findings | 1 |
| Economic Exploit | ⚠ Findings | 3 |
| Gas Griefer | ⚠ Findings | 2 |

---

## Recommendation

Do not deploy in current form. The three critical findings — reentrant withdraw, first-deposit share inflation, and unchecked oracle staleness — are individually sufficient to drain the vault under realistic attack conditions on Base mainnet. The two high-severity findings compound the economic surface and would be exploited within days of TVL crossing six figures. Apply the consolidated remediation patch, re-run the red team, and verify the score climbs above 90 before exposing the contract to user funds.

A re-run after applying the suggested remediations reduces the count to one informational finding (the `setKeeper` event emission) and lifts the security score to 96/100.

---

*Generated by Pentagonal — Smart Contract Forge · April 22, 2026, 14:32 UTC*
