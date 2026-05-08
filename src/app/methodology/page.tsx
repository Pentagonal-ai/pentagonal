import type { Metadata } from 'next';
import Link from 'next/link';
import '../marketing.css';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';
import {
  ReentrancyIcon, FlashLoanIcon, AccessControlIcon, OverflowIcon,
  OracleIcon, MEVIcon, EconomicIcon, GasIcon, ArrowRightIcon,
} from '@/components/landing/Icons';

export const metadata: Metadata = {
  title: 'Methodology — Pentagonal',
  description: 'How Pentagonal’s red team of eight specialised attackers reviews every smart contract: vulnerability classes, hack history, patterns hunted, sample findings.',
  alternates: { canonical: 'https://pentagonal.ai/methodology' },
};

type Chapter = {
  n: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  hunts: string;
  patterns: string[];
  history: { name: string; year: string; loss: string; note: string }[];
  finding: { title: string; severity: 'Critical' | 'High' | 'Medium'; code: string; analysis: string };
};

const CHAPTERS: Chapter[] = [
  {
    n: '01',
    name: 'Reentrancy Hunter',
    Icon: ReentrancyIcon,
    hunts: 'Functions that hand control to an external address before they finish updating their own state. Once an attacker holds the call, anything that depends on a state variable not yet written becomes a re-entry primitive.',
    patterns: [
      'External calls placed before state mutations (the classic checks-effects-interactions inversion).',
      'Cross-function reentry via shared storage — withdraw and a different state-mutating function reading the same balance.',
      'Read-only reentrancy — view functions that return stale values during an external call, exploited by integrating protocols.',
      'ERC-777 tokensReceived and ERC-1155 onERC1155Received hook callbacks invoked mid-transfer.',
      'Native ETH transfers using call{value:}("") without ReentrancyGuard or pull-over-push.',
      'Compiler reentrancy — Vyper 0.2.15–0.3.0 emitted a flawed @nonreentrant lock that did not actually prevent re-entry.',
    ],
    history: [
      { name: 'The DAO', year: '2016', loss: '~3.6M ETH (~$60M)', note: 'Recursive splitDAO call drained tokens before the balance was zeroed. The vector that hard-forked Ethereum into ETH and ETC.' },
      { name: 'Lendf.Me', year: '2020', loss: '$25M', note: 'ERC-777 transferFrom callback re-entered supply() before the borrow position was settled.' },
      { name: 'Cream Finance', year: '2021', loss: '$130M', note: 'AMP token tokensReceived hook combined with a flash loan to re-enter borrow during a single block.' },
      { name: 'Curve Finance', year: '2023', loss: '~$73M', note: 'Vyper compiler bug — the @nonreentrant lock did not enforce. Affected pools using stETH, msETH, alETH, and CRV.' },
    ],
    finding: {
      title: 'Reentrant withdraw permits balance reuse before state update',
      severity: 'Critical',
      code: `function withdraw(uint256 amt) external {
    require(bal[msg.sender] >= amt);
    (bool ok,) = msg.sender.call{value: amt}(""); // EXTERNAL CALL
    require(ok, "transfer failed");
    bal[msg.sender] -= amt;                       // STATE WRITE AFTER
}`,
      analysis: 'State is mutated after the external call. A malicious recipient can re-enter withdraw while bal still reflects the pre-debit balance, draining the contract. Remediation: invert to checks-effects-interactions, write bal first, or apply OpenZeppelin ReentrancyGuard.',
    },
  },
  {
    n: '02',
    name: 'Flash Loan Attacker',
    Icon: FlashLoanIcon,
    hunts: 'State that can be moved within a single block by anyone with access to uncollateralised liquidity. Price feeds, governance vote weight, reward accounting, and liquidation thresholds are the usual targets.',
    patterns: [
      'On-chain TVL or LP-share-based price oracles read at the same block they can be manipulated in.',
      'Governance vote weight derived from spot balance instead of time-weighted snapshot.',
      'Reward distributions calculated against in-block balances.',
      'Liquidation eligibility computed from manipulable spot prices.',
      'Single-block deposit-and-borrow loops that arbitrage protocol parameters.',
    ],
    history: [
      { name: 'bZx', year: '2020', loss: '~$954k', note: 'Two attacks in four days. Flash-loaned ETH, swapped through Uniswap to move sUSD price, opened an undercollateralised short.' },
      { name: 'Harvest Finance', year: '2020', loss: '$34M', note: 'Flash loan into Curve, manipulated y-pool price, deposited into and withdrew from yUSD vault for share-price arbitrage.' },
      { name: 'PancakeBunny', year: '2021', loss: '~$200M', note: 'Flash-loaned BNB to manipulate the BUNNY/BNB pair, triggered an over-mint of BUNNY rewards, dumped into the same pool.' },
      { name: 'Beanstalk', year: '2022', loss: '$182M', note: 'Flash-loaned governance tokens to pass an emergency proposal that drained the protocol — single-block governance attack.' },
    ],
    finding: {
      title: 'Reward accounting reads in-block LP balance, vulnerable to flash-loan inflation',
      severity: 'Critical',
      code: `function harvest() external {
    // shares uses spot LP balance — attacker can flash-loan in
    uint256 shares = IERC20(LP).balanceOf(address(this));
    uint256 reward = (totalReward * shares) / totalShares;
    _mint(msg.sender, reward);
}`,
      analysis: 'totalShares and shares are read against the current block. A flash loan into the LP inflates shares for one block, draining a disproportionate reward. Remediation: snapshot LP balance at deposit-time, or require a time-weighted average over n blocks.',
    },
  },
  {
    n: '03',
    name: 'Access Control Prober',
    Icon: AccessControlIcon,
    hunts: 'Functions that should be privileged but are not, initializers that can be called twice, role grants that escalate, and proxy admin paths that bypass timelocks. The simplest class of bug; still the most expensive when missed.',
    patterns: [
      'Privileged functions missing onlyOwner / onlyRole / AccessControl modifiers.',
      'Initializers without initializer modifier — callable a second time to reassign owner.',
      'Constructor logic in upgradeable contracts — runs on the implementation, not the proxy.',
      'Proxy admin functions reachable through the proxy interface (transparent vs UUPS confusion).',
      'Role-mint paths where DEFAULT_ADMIN_ROLE can grant itself MINTER_ROLE post-deployment.',
      'Unrenounced ownership when contracts are advertised as immutable.',
    ],
    history: [
      { name: 'Poly Network', year: '2021', loss: '$611M', note: 'Cross-chain manager accepted unauthorised messages — attacker forged a message granting themselves keeper role across chains. Funds returned by whitehat.' },
      { name: 'Wormhole', year: '2022', loss: '$325M', note: 'Signature verification used a deprecated Solana sysvar that an attacker could supply directly, bypassing guardian checks. 120k wETH minted on Solana.' },
      { name: 'Nomad Bridge', year: '2022', loss: '~$190M', note: 'An initialisation set the trusted root to 0x00, marking every message as proven. Anyone could replay any message body.' },
      { name: 'Audius', year: '2022', loss: '~$1.1M', note: 'Proxy initializer left unprotected after upgrade — attacker re-initialised governance to themselves.' },
    ],
    finding: {
      title: 'Initializer is publicly callable and lacks the initializer modifier',
      severity: 'Critical',
      code: `function init(address _admin) external {
    // no initializer modifier
    require(admin == address(0), "already set");
    admin = _admin;
}`,
      analysis: 'The require check protects against re-initialisation only if admin is never zero again. If a future upgrade re-introduces admin = address(0), the function is callable by anyone. Remediation: import OpenZeppelin Initializable and apply the initializer modifier; never gate ownership on a mutable storage check.',
    },
  },
  {
    n: '04',
    name: 'Overflow Saboteur',
    Icon: OverflowIcon,
    hunts: 'Integer math that wraps, rounds, or loses precision in a way that benefits an attacker. Solidity 0.8 protects most paths by default, but assembly, unchecked blocks, and fixed-point math reintroduce the entire pre-SafeMath surface.',
    patterns: [
      'unchecked { } blocks where the bound is not provably safe.',
      'Inline assembly performing add / sub / mul without overflow guards.',
      'Fixed-point arithmetic with division before multiplication — silent precision loss.',
      'Casts from uint256 to smaller types (uint128, uint64) without explicit range checks.',
      'Pre-0.8 contracts deployed without SafeMath — still in production for many proxies.',
      'Token decimals mismatches between USDC (6) and most ERC-20s (18).',
    ],
    history: [
      { name: 'BeautyChain (BEC)', year: '2018', loss: 'Token rendered worthless', note: 'Overflow in batchTransfer multiplied amount * receivers, wrapping to zero. Sender passed amount checks while transferring near-infinite tokens.' },
      { name: 'PoWHC / various early ERC-20s', year: '2018', loss: '$multiple', note: 'Pre-SafeMath multiplications wrapped to zero, allowing minting beyond intended supply.' },
      { name: 'Compound Drip', year: '2021', loss: '~$80M COMP overpaid', note: 'Distribution calculation used a stale exchange rate — not strictly overflow, but precision-loss class. Required a governance pause and partial recovery.' },
      { name: 'Hundred Finance', year: '2023', loss: '$7.4M', note: 'Empty-market share-price inflation via decimals mismatch — attacker donated tokens to manipulate exchangeRate.' },
    ],
    finding: {
      title: 'Reward calculation divides before multiplying, zeroing small balances',
      severity: 'High',
      code: `function reward(uint256 stake, uint256 totalStake) public view returns (uint256) {
    // division first — small stakes round to 0
    return (stake / totalStake) * rewardPool;
}`,
      analysis: 'Integer division truncates. Any stake < totalStake yields zero before multiplication. Remediation: reorder to (stake * rewardPool) / totalStake, with overflow protection by sizing rewardPool to fit uint256 ÷ max(totalStake).',
    },
  },
  {
    n: '05',
    name: 'Oracle Manipulator',
    Icon: OracleIcon,
    hunts: 'Price feeds that can be moved, spoofed, or read stale. Almost every DeFi exploit since 2020 has an oracle component — the manipulator is what surfaces them before the market does.',
    patterns: [
      'Spot-price oracles derived from a single AMM pair — manipulable with a single trade.',
      'TWAP windows shorter than the cost of moving the underlying pool.',
      'Single-source feeds with no fallback or sanity bound.',
      'Stale Chainlink rounds — missing checks on roundId, updatedAt, and answeredInRound.',
      'L2 sequencer-down conditions that freeze price feeds while liquidations continue.',
      'Reward-rate setters that read price at call time without staleness validation.',
    ],
    history: [
      { name: 'bZx', year: '2020', loss: '~$954k', note: 'Manipulated Uniswap sUSD spot price within a single transaction to borrow against an inflated collateral value.' },
      { name: 'Cream Finance', year: '2021', loss: '$130M', note: 'yUSD price oracle inflation via Curve y-pool manipulation, combined with a flash loan and reentrancy.' },
      { name: 'Mango Markets', year: '2022', loss: '$116M', note: 'Avraham Eisenberg pumped MNGO perp price on Mango itself, then borrowed against the inflated unrealised PnL.' },
      { name: 'Inverse Finance', year: '2022', loss: '$15.6M', note: 'INV/DOLA price manipulated through a thin Uniswap v2 pool used as the protocol oracle.' },
    ],
    finding: {
      title: 'Reward rate setter accepts price without staleness check',
      severity: 'Critical',
      code: `function setRewardRate() external {
    (, int256 price,,,) = chainlinkFeed.latestRoundData();
    require(price > 0, "bad price");
    rewardRate = uint256(price) / 1e8;
}`,
      analysis: 'No checks on roundId / answeredInRound / updatedAt. If the feed is stale (sequencer down, round not yet posted), the call returns a price hours or days old. Remediation: require updatedAt > block.timestamp - heartbeat and answeredInRound >= roundId; on L2, gate on the sequencer uptime feed.',
    },
  },
  {
    n: '06',
    name: 'MEV Predator',
    Icon: MEVIcon,
    hunts: 'Order-of-execution dependence. Anything where the outcome differs based on who arrives first — swaps, auctions, NFT mints, governance — is a sandwich, frontrun, or backrun primitive.',
    patterns: [
      'Swap functions without amountOutMin (slippage tolerance) — sandwich-trivial.',
      'Auctions without commit-reveal — the highest visible bid is always the winning bid + 1 wei.',
      'Mint functions where a public read function reveals the next price tier mid-block.',
      'Liquidations distributed first-come-first-served instead of via Dutch auction.',
      'Governance proposals where execution depends on the order of votes within the same block.',
      'AMM rebalances that announce the target ratio before the trade lands.',
    ],
    history: [
      { name: 'Generalised MEV', year: 'ongoing', loss: '$1B+ annually', note: 'Per Flashbots / EigenPhi, sandwich attacks alone extract hundreds of millions per year from unsophisticated swaps on Ethereum and Base.' },
      { name: 'Curve sandwich incidents', year: '2023', loss: 'Multiple $100k+', note: 'Large LP withdrawals frontrun for slippage capture, particularly on stable-to-volatile pools.' },
      { name: 'NFT mint frontrunning', year: '2021–2023', loss: 'Thousands of incidents', note: 'Free-mint contracts using msg.sender == tx.origin consistently lost reservation slots to MEV bots.' },
    ],
    finding: {
      title: 'Swap accepts no slippage parameter — sandwich-trivial',
      severity: 'High',
      code: `function buy() external payable {
    uint256 out = router.swapExactETHForTokens{value: msg.value}(
        0,                  // amountOutMin = 0
        path, msg.sender, block.timestamp
    );
}`,
      analysis: 'amountOutMin set to zero accepts any output. A sandwich bot frontruns with a buy that moves price, fills the user at the worst rate, and backruns with a sell capturing the spread. Remediation: accept amountOutMin from the caller and validate it against an off-chain quote with explicit deadline.',
    },
  },
  {
    n: '07',
    name: 'Economic Exploit',
    Icon: EconomicIcon,
    hunts: 'Edge cases in protocol math that are valid Solidity but catastrophic economics. Donation attacks, share-price inflation, fee-on-transfer mismatches, rounding asymmetries — the ones that pass formal verification because they’re features, not bugs.',
    patterns: [
      'Empty-vault share-price inflation — first depositor donates tokens to make subsequent shares cost ≥ 1 unit.',
      'Fee-on-transfer tokens treated as 1:1 transfers, breaking accounting after every move.',
      'Rebasing tokens whose balance changes silently between block N and block N+1.',
      'Liquidation discount + dust debt combinations that strand positions.',
      'Reward distributions where withdrawing before / after a rebase yields different outcomes.',
      'ERC-4626 deposits that round in the user’s favour rather than the vault’s.',
    ],
    history: [
      { name: 'Hundred Finance', year: '2023', loss: '$7.4M', note: 'Empty-market share-price inflation — attacker created a market, donated tokens to inflate exchangeRate, borrowed against a single share.' },
      { name: 'Euler Finance', year: '2023', loss: '$197M', note: 'donateToReserves let an attacker push their own debt into bad-debt territory, triggering self-liquidation at a profit.' },
      { name: 'Curve Finance', year: '2023', loss: '~$73M', note: 'Vyper compiler reentrancy combined with stETH-ETH rebalancing math in stable pools.' },
      { name: 'Hopelessly long tail', year: 'ongoing', loss: '$100s of M', note: 'Yearn, Cream, Inverse, Beanstalk, Saddle, Mim — economic-class bugs survive line-by-line review and only emerge under adversarial exploration.' },
    ],
    finding: {
      title: 'ERC-4626 deposit allows first-depositor share-price inflation',
      severity: 'Critical',
      code: `function deposit(uint256 assets) external returns (uint256 shares) {
    if (totalSupply() == 0) {
        shares = assets;            // 1:1 only if first depositor
    } else {
        shares = assets * totalSupply() / asset.balanceOf(address(this));
    }
    _mint(msg.sender, shares);
}`,
      analysis: 'A first depositor mints 1 share for 1 wei, then donates a large amount of asset directly to the contract. asset.balanceOf becomes huge while totalSupply stays at 1. The next depositor’s shares round to zero, granting nothing. Remediation: mint a baseline of 1e3 dead shares to a burn address, or require minimum first-deposit thresholds (OpenZeppelin’s ERC4626 inflation-attack mitigation).',
    },
  },
  {
    n: '08',
    name: 'Gas Griefer',
    Icon: GasIcon,
    hunts: 'Code that turns a denial-of-service vector into a governance lever or a profit centre. Unbounded loops, refund mechanisms that revert, storage layouts that punish callers, and gas-griefing tactics that target oracles, keepers, and crosschain messengers.',
    patterns: [
      'Unbounded for-loops over user-controlled arrays — grow the array, freeze the function.',
      'Refund logic that reverts when the recipient cannot accept ETH.',
      'Pull-payment patterns implemented as push-payments.',
      'send / transfer with hard-coded 2300 gas — fails for any contract recipient.',
      'Storage layouts that force redundant SLOADs in the hot path.',
      'Cross-chain messengers without out-of-gas defence on the receiving side.',
    ],
    history: [
      { name: 'King of the Ether', year: '2016', loss: 'Game soft-locked', note: 'Refund to the previous king sent via send() — a contract recipient that reverted prevented anyone from claiming the throne.' },
      { name: 'GovernMental Ponzi', year: '2016', loss: '~1100 ETH stuck', note: 'Looped over a creditor list that grew past the block gas limit, permanently freezing payouts.' },
      { name: 'Akutar Mint', year: '2022', loss: '$34M permanently locked', note: 'Refund mechanism reverted on contract participants. The contract had no rescue path; funds remain unrecoverable.' },
      { name: 'Cross-chain bridge OOM patterns', year: 'ongoing', loss: 'Numerous', note: 'Receiving messengers that loop over recipient call data are repeatedly griefed to drop messages.' },
    ],
    finding: {
      title: 'Unbounded loop over withdrawals enables governance DoS',
      severity: 'High',
      code: `function payAll() external onlyOwner {
    for (uint i = 0; i < beneficiaries.length; i++) {
        // unbounded — attacker calls register() repeatedly to grow the array
        beneficiaries[i].call{value: amounts[i]}("");
    }
}`,
      analysis: 'beneficiaries can be appended without limit. Once the loop exceeds the block gas limit, payAll permanently reverts. Remediation: switch to pull-payment (each beneficiary calls claim() themselves), or paginate with a startIndex / endIndex.',
    },
  },
];

export default function MethodologyPage() {
  return (
    <div data-marketing="true">
      <MarketingHeader />
      <main>
        {/* Hero */}
        <section className="m-section m-section--first" style={{ paddingTop: 96, paddingBottom: 64 }}>
          <div className="m-container">
            <div className="m-prose">
              <span className="m-eyebrow">Methodology</span>
              <h1 className="m-h1" style={{ marginTop: 24, marginBottom: 24 }}>
                How the red team works.
              </h1>
              <p className="m-lede">
                Eight specialised attackers run against every contract you submit.
                Each is fluent in a single class of exploit, briefed against the
                full history of how that class has been used to drain real
                protocols, and instructed to break the contract within those
                bounds. What follows is the briefing each one operates from.
              </p>
            </div>

            <nav className="m-meth-toc" aria-label="Adversaries">
              {CHAPTERS.map(c => (
                <a key={c.n} href={`#a-${c.n}`} className="m-meth-toc-item">
                  <span className="m-meth-toc-num">{c.n}</span>
                  <span className="m-meth-toc-name">{c.name}</span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Chapters */}
        {CHAPTERS.map(c => {
          const Icon = c.Icon;
          return (
            <section key={c.n} className="m-meth-chapter" id={`a-${c.n}`}>
              <div className="m-container">
                <header className="m-meth-chapter-head">
                  <Icon className="m-meth-chapter-icon" />
                  <div>
                    <div className="m-meth-chapter-num">ADVERSARY {c.n}</div>
                    <h2 className="m-meth-chapter-name">{c.name}</h2>
                  </div>
                </header>

                <div className="m-meth-chapter-body">
                  <div className="m-meth-block">
                    <h3 className="m-meth-block-title">What it hunts</h3>
                    <p className="m-meth-block-text">{c.hunts}</p>
                  </div>

                  <div className="m-meth-block">
                    <h3 className="m-meth-block-title">Patterns it tests</h3>
                    <ul className="m-meth-list">
                      {c.patterns.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>

                  <div className="m-meth-block">
                    <h3 className="m-meth-block-title">Hack history briefed against</h3>
                    <ul className="m-meth-history">
                      {c.history.map((h, i) => (
                        <li key={i}>
                          <div className="m-meth-history-head">
                            <span className="m-meth-history-name">{h.name}</span>
                            <span className="m-meth-history-meta">{h.year} · {h.loss}</span>
                          </div>
                          <p className="m-meth-history-note">{h.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="m-meth-block">
                    <h3 className="m-meth-block-title">Sample finding</h3>
                    <div className="m-meth-finding">
                      <div className="m-meth-finding-head">
                        <span className="m-meth-finding-title">{c.finding.title}</span>
                        <span className={`m-artifact-tag m-artifact-tag--${c.finding.severity.toLowerCase()}`}>
                          {c.finding.severity}
                        </span>
                      </div>
                      <code className="m-meth-finding-code">{c.finding.code}</code>
                      <p className="m-meth-finding-analysis">{c.finding.analysis}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing — consolidation */}
        <section className="m-section" id="consolidation">
          <div className="m-container">
            <div className="m-prose">
              <span className="m-eyebrow">Report consolidation</span>
              <h2 className="m-h2">
                One report, deduplicated,
                graded by exploit cost.
              </h2>
              <p className="m-lede" style={{ marginTop: 24 }}>
                Each attacker submits findings independently. A consolidator
                pass cross-references every finding against the other seven,
                merges duplicates, and grades severity by what an attacker
                would actually need to spend to exploit it on mainnet —
                not by an arbitrary critical / high / medium ladder.
              </p>
              <p className="m-lede" style={{ marginTop: 16 }}>
                Findings unique to a single attacker are flagged for human
                review. Findings confirmed by two or more are escalated. The
                output is the same artefact whether you reached it from
                Claude Desktop, Cursor, the web app, or an autonomous agent
                paying via x402.
              </p>
            </div>

            <div className="m-hero-actions" style={{ marginTop: 40 }}>
              <Link href="/forge" className="m-btn m-btn--primary">
                Run the red team
                <ArrowRightIcon className="m-btn-arrow" />
              </Link>
              <Link href="/" className="m-btn">
                Back to overview
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
