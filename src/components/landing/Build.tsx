export function Build() {
  return (
    <section className="m-section" id="build">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Build</span>
          <h2 className="m-h2">
            From a plain-English spec
            to attacker-tested Solidity.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            Pentagonal scopes the contract with you, surfacing the
            decisions an attacker would later target — supply, fees,
            roles, upgradeability. Then it generates the code,
            referenced against OpenZeppelin v5 for Solidity and the
            Anchor framework for Solana, and hands it straight to the
            red team.
          </p>
        </div>

        <div className="m-build-flow">
          <div className="m-build-step">
            <div className="m-build-num">Step 01 · Describe</div>
            <h3 className="m-h3">A sentence is enough to start.</h3>
            <p className="m-build-desc">
              Plain English. No template form. The model handles the
              rest of the scoping conversation.
            </p>
            <code className="m-build-quote">
              &ldquo;ERC-4626 staking vault for our governance token
              with a seven-day unlock and a one-percent performance
              fee, paused by a timelocked admin.&rdquo;
            </code>
          </div>

          <div className="m-build-step">
            <div className="m-build-num">Step 02 · Scope</div>
            <h3 className="m-h3">Pentagonal asks what attackers would.</h3>
            <p className="m-build-desc">
              Decisions that hide bugs are pulled to the front. You
              answer them once; they land in the contract and the
              audit report.
            </p>
            <ul className="m-build-questions">
              <li>Should the vault accept additional reward tokens, or single-asset only?</li>
              <li>Who pauses emergency withdrawals — the admin, a guardian, or no-one?</li>
              <li>Performance fee taken on deposit, on withdraw, or on harvest?</li>
              <li>Pre-deposit donation protection — virtual shares or initial seed?</li>
            </ul>
          </div>

          <div className="m-build-step">
            <div className="m-build-num">Step 03 · Generate</div>
            <h3 className="m-h3">Solidity or Anchor, streamed.</h3>
            <p className="m-build-desc">
              Production-grade code against the most current
              standards. Compilation is free; the audit runs on the
              same artefact you deploy.
            </p>
            <code className="m-build-code">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract SentinelVault is ERC4626, AccessControl, Pausable {
    bytes32 public constant GUARDIAN = keccak256("GUARDIAN");
    uint256 public constant UNLOCK = 7 days;
    uint256 public constant PERF_BPS = 100; // 1.00%

    mapping(address => uint256) public unlockAt;
    /* … */
}`}
            </code>
          </div>
        </div>

        <p className="m-build-foot">
          Every generation goes straight to the red team. Findings come
          back inline; fixes and recompiles are free for the same
          contract.
        </p>
      </div>
    </section>
  );
}
