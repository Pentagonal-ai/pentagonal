import Link from 'next/link';
import {
  ReentrancyIcon, FlashLoanIcon, AccessControlIcon, GasIcon,
  OracleIcon, MEVIcon, OverflowIcon, EconomicIcon,
  ArrowRightIcon,
} from './Icons';

const ADVERSARIES = [
  {
    n: '01',
    name: 'Reentrancy Hunter',
    icon: ReentrancyIcon,
    desc: 'Forces re-entry through external-call ordering, cross-function paths, read-only reentrancy via view functions, and ERC-777/1155 hooks.',
  },
  {
    n: '02',
    name: 'Flash Loan Attacker',
    icon: FlashLoanIcon,
    desc: 'Manipulates price oracles, governance, and reward accounting inside a single block, funded by uncollateralised flash liquidity.',
  },
  {
    n: '03',
    name: 'Access Control Prober',
    icon: AccessControlIcon,
    desc: 'Hunts missing modifiers, role-mint paths, initializer reentry, proxy admin escalation, and unrenounced ownership.',
  },
  {
    n: '04',
    name: 'Overflow Saboteur',
    icon: OverflowIcon,
    desc: 'Wraps integers through unchecked blocks, fixed-point precision loss, division ordering, and pre-0.8 patterns reintroduced via assembly.',
  },
  {
    n: '05',
    name: 'Oracle Manipulator',
    icon: OracleIcon,
    desc: 'Pushes spot-price reliance, single-source feeds, stale-round usage, TWAP window choice, and Chainlink heartbeat handling.',
  },
  {
    n: '06',
    name: 'MEV Predator',
    icon: MEVIcon,
    desc: 'Hunts sandwich exposure, slippage parameters, missing commit-reveal, and order-of-execution dependence in swap and auction paths.',
  },
  {
    n: '07',
    name: 'Economic Exploit',
    icon: EconomicIcon,
    desc: 'Drives reward dilution, donation attacks against share-based vaults, fee-on-transfer asymmetry, and rounding in ERC-4626 deposits.',
  },
  {
    n: '08',
    name: 'Gas Griefer',
    icon: GasIcon,
    desc: 'Weaponises storage layout, redundant SLOADs, calldata-vs-memory choices, and unbounded loops that turn DoS into a governance lever.',
  },
];

export function Methodology() {
  return (
    <section className="m-section" id="adversaries">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Adversaries</span>
          <h2 className="m-h2">
            Eight attackers run in parallel.
            What survives all of them ships.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Each attacker owns a single class of exploit. They run against the
            same contract independently, cross-confirm each other&rsquo;s
            findings, and converge on a deduplicated report graded by exploit
            cost — not severity-by-vibes.
          </p>
        </div>

        <div className="m-meth-grid">
          {ADVERSARIES.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.n} className="m-meth-cell">
                <Icon className="m-meth-icon" />
                <div className="m-meth-num">ADVERSARY {a.n}</div>
                <div className="m-meth-title">{a.name}</div>
                <div className="m-meth-desc">{a.desc}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/methodology" className="m-btn">
            Read the full briefing
            <ArrowRightIcon className="m-btn-arrow" />
          </Link>
          <a href="/sample-audit-report-human.md" target="_blank" rel="noreferrer" className="m-btn m-btn--ghost">
            Or read a sample report (human) →
          </a>
          <a href="/sample-audit-report.md" target="_blank" rel="noreferrer" className="m-btn m-btn--ghost">
            (agent format) →
          </a>
        </div>
      </div>
    </section>
  );
}
