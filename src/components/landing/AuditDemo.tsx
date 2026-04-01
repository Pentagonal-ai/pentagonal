'use client';

import { useEffect, useState, useRef } from 'react';

const AGENTS = [
  { name: 'Reentrancy Scanner', outcomes: ['clear', 'finding'] },
  { name: 'Access Control', outcomes: ['clear', 'critical'] },
  { name: 'Arithmetic Guard', outcomes: ['clear', 'finding'] },
  { name: 'Gas Optimizer', outcomes: ['finding', 'finding'] },
  { name: 'Logic Analyzer', outcomes: ['clear', 'clear'] },
];

type AgentStatus = 'idle' | 'scanning' | 'clear' | 'finding' | 'critical';

export function AuditDemo() {
  const [statuses, setStatuses] = useState<AgentStatus[]>(AGENTS.map(() => 'idle'));
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isRunning) {
          setIsRunning(true);
          runDemo();
        }
      },
      { threshold: 0.4 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const runDemo = () => {
    // Reset
    setStatuses(AGENTS.map(() => 'idle'));
    setProgress(0);

    AGENTS.forEach((agent, i) => {
      // Stagger start: each agent starts 400ms after the previous
      const startDelay = i * 400;
      const scanDuration = 1200 + Math.random() * 800;

      setTimeout(() => {
        setStatuses((prev) => {
          const next = [...prev];
          next[i] = 'scanning';
          return next;
        });
        setProgress(((i + 0.5) / AGENTS.length) * 100);
      }, startDelay);

      setTimeout(() => {
        const outcome = agent.outcomes[Math.floor(Math.random() * agent.outcomes.length)] as AgentStatus;
        setStatuses((prev) => {
          const next = [...prev];
          next[i] = outcome;
          return next;
        });
        setProgress(((i + 1) / AGENTS.length) * 100);
      }, startDelay + scanDuration);
    });

    // Reset after full cycle for replay
    const totalDuration = AGENTS.length * 400 + 2000 + 3000;
    setTimeout(() => setIsRunning(false), totalDuration);
  };

  const statusLabel = (s: AgentStatus) => {
    switch (s) {
      case 'idle': return '—';
      case 'scanning': return 'Scanning...';
      case 'clear': return '✓ Clear';
      case 'finding': return '⚠ Finding';
      case 'critical': return '✕ Critical';
    }
  };

  return (
    <section className="marketing-section" ref={sectionRef}>
      <div className="marketing-section-label">Live Audit Preview</div>
      <h2 className="marketing-section-title">5 agents. Zero blind spots.</h2>
      <p className="marketing-section-desc">
        Watch a multi-agent security scan in action. Each agent specializes in a different attack vector and runs autonomously.
      </p>

      <div className="audit-demo-container">
        <div className="audit-demo-header">
          <div className={`audit-demo-dot ${isRunning ? 'active' : ''}`} />
          <span className="audit-demo-title">
            {isRunning ? 'Audit in progress...' : 'Audit complete'}
          </span>
        </div>
        <div className="audit-demo-body">
          {AGENTS.map((agent, i) => (
            <div key={agent.name} className="audit-demo-agent">
              <span className="audit-demo-agent-name">{agent.name}</span>
              <span className={`audit-demo-agent-status ${statuses[i]}`}>
                {statusLabel(statuses[i])}
              </span>
            </div>
          ))}
          <div className="audit-demo-progress">
            <div
              className="audit-demo-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
