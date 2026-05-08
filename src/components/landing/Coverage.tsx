const CHAINS_EVM = [
  'Ethereum', 'Polygon', 'BNB Chain', 'Arbitrum',
  'Base', 'Optimism', 'Avalanche',
];

const TESTNETS = [
  'Sepolia', 'Holesky', 'Polygon Amoy', 'Arbitrum Sepolia',
  'Base Sepolia', 'OP Sepolia', 'Avalanche Fuji',
];

export function Coverage() {
  return (
    <section className="m-section" id="coverage">
      <div className="m-container">
        <div className="m-prose">
          <span className="m-eyebrow">Coverage</span>
          <h2 className="m-h2">
            Solidity and Anchor.
            Seven mainnets, seven testnets, one Solana cluster.
          </h2>
          <p className="m-lede" style={{ marginTop: 24 }}>
            EVM contracts are reviewed against OpenZeppelin and Solady
            references. Solana programs are reviewed against the Anchor
            framework and SPL conventions. Same agents, different idioms.
          </p>
        </div>

        <div className="m-coverage" role="table">
          <div className="m-coverage-row m-coverage-row--header" role="row">
            <div className="m-coverage-cell-label">Surface</div>
            <div className="m-coverage-cell-chains">Networks</div>
          </div>

          <div className="m-coverage-row" role="row">
            <div className="m-coverage-cell-label">EVM mainnets</div>
            <div className="m-coverage-cell-chains">
              {CHAINS_EVM.map(c => (
                <span key={c} className="m-chain-pill">{c}</span>
              ))}
            </div>
          </div>

          <div className="m-coverage-row" role="row">
            <div className="m-coverage-cell-label">EVM testnets</div>
            <div className="m-coverage-cell-chains">
              {TESTNETS.map(c => (
                <span key={c} className="m-chain-pill">{c}</span>
              ))}
            </div>
          </div>

          <div className="m-coverage-row" role="row">
            <div className="m-coverage-cell-label">Non-EVM</div>
            <div className="m-coverage-cell-chains">
              <span className="m-chain-pill">Solana mainnet</span>
              <span className="m-chain-pill">Solana devnet</span>
              <span className="m-chain-pill">Anchor 0.30+</span>
              <span className="m-chain-pill">SPL Token-2022</span>
            </div>
          </div>

          <div className="m-coverage-row" role="row">
            <div className="m-coverage-cell-label">Languages</div>
            <div className="m-coverage-cell-chains">
              <span className="m-chain-pill">Solidity 0.8.x</span>
              <span className="m-chain-pill">Yul / inline assembly</span>
              <span className="m-chain-pill">Rust (Anchor)</span>
            </div>
          </div>

          <div className="m-coverage-row" role="row">
            <div className="m-coverage-cell-label">Reference libraries</div>
            <div className="m-coverage-cell-chains">
              <span className="m-chain-pill">OpenZeppelin v5</span>
              <span className="m-chain-pill">Solady</span>
              <span className="m-chain-pill">Anchor</span>
              <span className="m-chain-pill">SPL</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
