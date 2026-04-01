'use client';

import { useEffect, useState, useRef } from 'react';

interface SelfLearningSectionProps {
  rulesCount: number;
}

export function SelfLearningSection({ rulesCount }: SelfLearningSectionProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated && rulesCount > 0) {
          setHasAnimated(true);
          // Animate count up
          const target = rulesCount;
          const duration = 1500;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [rulesCount, hasAnimated]);

  return (
    <section className="marketing-section" ref={sectionRef}>
      <div className="marketing-section-label">Self-Learning Engine</div>
      <h2 className="marketing-section-title">Every audit makes the next one smarter.</h2>
      <p className="marketing-section-desc">
        Pentagonal extracts security rules from every scan and feeds them back into the system. The more contracts it audits, the sharper it gets.
      </p>

      <div className="self-learning-content">
        <div className="self-learning-visual">
          <div>
            <div className="self-learning-counter">{displayCount}</div>
            <div className="self-learning-counter-label">Rules Learned</div>
          </div>
        </div>

        <div className="self-learning-rules">
          <div className="self-learning-rule">
            <span className="self-learning-rule-tag">Reentrancy</span>
            Check external calls follow checks-effects-interactions pattern. Flag state changes after .call&#123;&#125;()
          </div>
          <div className="self-learning-rule">
            <span className="self-learning-rule-tag">Access</span>
            Verify onlyOwner/Role modifiers on state-mutating functions. Flag unprotected selfdestruct and delegatecall.
          </div>
          <div className="self-learning-rule">
            <span className="self-learning-rule-tag">Gas</span>
            Detect storage reads in loops. Suggest caching to memory variables for 60-80% gas reduction.
          </div>
        </div>
      </div>
    </section>
  );
}
