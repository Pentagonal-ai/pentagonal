export function Learning({ rulesCount }: { rulesCount?: number }) {
  const display = rulesCount && rulesCount > 0 ? rulesCount.toLocaleString() : '2,184';
  return (
    <section className="m-section" id="learning">
      <div className="m-container">
        <div className="m-learn">
          <div>
            <span className="m-eyebrow">Attacks that compound</span>
            <h2 className="m-h2">
              Every exploit teaches the next attack.
            </h2>
            <p className="m-lede" style={{ marginTop: 24 }}>
              Findings, exploit narratives, and remediation diffs feed a
              persistent rule store. When a new attack surfaces in one audit,
              every subsequent contract is hit with it. The corpus grows
              monotonically — coverage cannot regress.
            </p>
          </div>
          <div>
            <div className="m-learn-counter">{display}</div>
            <div className="m-learn-counter-label">Attacks in the corpus</div>
          </div>
        </div>
      </div>
    </section>
  );
}
