import Link from 'next/link';
import { ArrowRightIcon } from './Icons';
import { InstallChip } from './InstallChip';

export function Hero() {
  return (
    <section className="m-hero">
      <div className="m-container">
        <div className="m-hero-grid">
          <div>
            <span className="m-eyebrow">Adversarial smart contract review</span>
            <h1 className="m-h1 m-hero-headline">
              We attack your contract<br />
              <em>before the market does.</em>
            </h1>
            <p className="m-lede">
              Pentagonal runs a permanent red team — eight specialised
              attackers, each fluent in a single class of exploit. Reentrancy,
              flash loans, oracle manipulation, MEV, economic edge cases,
              arithmetic overflow, access control, and gas griefing. They hunt
              every line you ship. The report is what&rsquo;s left after they
              fail.
            </p>
            <div className="m-hero-actions">
              <Link href="/forge" className="m-btn m-btn--primary">
                Build a contract
                <ArrowRightIcon className="m-btn-arrow" />
              </Link>
              <Link href="/forge" className="m-btn">
                Audit one you have
              </Link>
            </div>

            <div className="m-hero-install">
              <InstallChip command="npx -y pentagonal-mcp" />
              <a href="#integration" className="m-hero-install-aside">
                Or have your agent pay per call in USDC via x402
                <ArrowRightIcon className="m-btn-arrow" />
              </a>
            </div>

            <dl className="m-hero-stamp">
              <div>
                <dt>Coverage</dt>
                <dd>14 networks</dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>≈ 30 s / contract</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>Markdown · PDF</dd>
              </div>
            </dl>
          </div>

          <aside className="m-artifact" aria-label="Sample finding">
            <div className="m-artifact-head">
              <span>Finding 03 of 11 · Vault.sol</span>
              <span className="m-artifact-tag m-artifact-tag--critical">Critical</span>
            </div>
            <div className="m-artifact-body">
              <div className="m-artifact-title">
                Reentrant withdraw permits balance reuse before state update
              </div>
              <code className="m-artifact-code">
{`function withdraw(uint256 amt) external {
  require(bal[msg.sender] >= amt);
`}<span className="hl">{`  (bool ok,) = msg.sender.call{value: amt}("");
  require(ok, "transfer failed");
  bal[msg.sender] -= amt;`}</span>{`
}`}
              </code>
              <div style={{ fontFamily: 'var(--m-font-sans)', fontSize: 13.5, color: 'var(--m-fg-muted)', lineHeight: 1.55 }}>
                State is mutated after the external call. A malicious recipient
                can reenter <code>withdraw</code> while <code>bal</code> still
                reflects the pre-debit balance, draining the contract.
              </div>
            </div>
            <div className="m-artifact-foot">
              <span>Broken by <strong>Reentrancy Hunter</strong></span>
              <span>·</span>
              <span>Confirmed by <strong>Economic Exploit</strong></span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
