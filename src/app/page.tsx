'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  type Chain, type Mode, type AppState, type Finding, type Agent,
  type AuditReport, type ScopeMessage, type ScopeButton,
  CHAINS, DEFAULT_AGENTS,
} from '@/lib/types';
import type { SolanaType } from '@/lib/claude';
import { createClient } from '@/lib/supabase/client';
import { PentagonLogo, PentagonMark } from '@/components/PentagonLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SignInModal } from '@/components/SignInModal';
import { useCredits } from '@/hooks/useCredits';

import { FeaturePillars } from '@/components/landing/FeaturePillars';
import { SelfLearningSection } from '@/components/landing/SelfLearningSection';
import { ChainShowcase } from '@/components/landing/ChainShowcase';
import { AuditDemo } from '@/components/landing/AuditDemo';
import { PricingSection } from '@/components/landing/PricingSection';
import { MCPSetupSection } from '@/components/landing/MCPSetupSection';
import { Footer } from '@/components/landing/Footer';
import type { User } from '@supabase/supabase-js';

// Lazy-load deploy panels to avoid wallet hook SSR issues
const EVMDeployPanel = lazy(() => import('@/components/EVMDeployPanel').then(m => ({ default: m.EVMDeployPanel })));
const SolanaDeployPanel = lazy(() => import('@/components/SolanaDeployPanel').then(m => ({ default: m.SolanaDeployPanel })));
const SolanaPlaygroundGuide = lazy(() => import('@/components/SolanaPlaygroundGuide').then(m => ({ default: m.SolanaPlaygroundGuide })));
const DeployHistoryPanel = lazy(() => import('@/components/DeployHistoryPanel').then(m => ({ default: m.DeployHistoryPanel })));
const PaymentModalLazy = lazy(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })));
const ApiKeysModalLazy = lazy(() => import('@/components/ApiKeysModal').then(m => ({ default: m.ApiKeysModal })));


// ─── Simple syntax highlighting ───
function highlightSolidity(line: string): string {
  return line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\/\/.*)$/gm, '<span class="syn-comment">$1</span>')
    .replace(/\b(pragma|solidity|contract|function|returns?|import|from|public|private|internal|external|view|pure|payable|modifier|event|emit|mapping|struct|enum|if|else|for|while|require|revert|assert|using|is|abstract|interface|library|override|virtual|memory|storage|calldata|constructor|msg|block|tx|address|uint256|uint|int|bool|string|bytes|bytes32)\b/g,
      '<span class="syn-keyword">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="syn-keyword">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>')
    .replace(/"([^"]*)"/g, '<span class="syn-string">"$1"</span>')
    .replace(/'([^']*)'/g, '<span class="syn-string">\'$1\'</span>');
}

// ─── Report markdown generator ───
function generateReportMarkdown(report: AuditReport, contractName: string): string {
  const criticals = report.findings.filter(f => f.severity === 'critical');
  const highs = report.findings.filter(f => f.severity === 'high');
  const mediums = report.findings.filter(f => f.severity === 'medium');
  const lows = report.findings.filter(f => f.severity === 'low');

  let md = `# Pentagonal Security Audit Report\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Contract | ${contractName} |\n`;
  md += `| Chain | ${report.chain} |\n`;
  md += `| Date | ${new Date(report.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} |\n`;
  md += `| Security Score | ${report.riskScore}/100 |\n`;
  md += `| Rules Applied | ${report.rulesApplied} |\n\n`;

  md += `---\n\n## Executive Summary\n\n${report.summary}\n\n`;

  if (report.methodology) {
    md += `## Methodology\n\n${report.methodology}\n\n`;
  }

  md += `## Findings Overview\n\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  md += `| Critical | ${criticals.length} |\n`;
  md += `| High | ${highs.length} |\n`;
  md += `| Medium | ${mediums.length} |\n`;
  md += `| Low | ${lows.length} |\n`;
  md += `| **Total** | **${report.findings.length}** |\n\n`;

  // Code Segment Analysis
  if (report.codeSegments && report.codeSegments.length > 0) {
    md += `---\n\n## Code Segment Review\n\n`;
    for (let i = 0; i < report.codeSegments.length; i++) {
      const seg = report.codeSegments[i];
      const segFindings = report.findings.filter(f =>
        f.line && f.line >= seg.startLine && f.line <= seg.endLine
      );
      md += `### ${i + 1}. ${seg.title} (L${seg.startLine}–${seg.endLine}) — ${seg.risk.toUpperCase()}\n\n`;
      md += `${seg.summary}\n\n`;
      md += `\`\`\`solidity\n${seg.code}\n\`\`\`\n\n`;
      if (segFindings.length > 0) {
        md += `**Findings in this segment:**\n`;
        for (const f of segFindings) {
          md += `- [${f.severity.toUpperCase()}] ${f.title}${f.line ? ` (L${f.line})` : ''}\n`;
        }
        md += `\n`;
      }
    }
  }

  // Detailed Findings
  if (report.findings.length > 0) {
    md += `---\n\n## Detailed Findings\n\n`;
    for (let i = 0; i < report.findings.length; i++) {
      const f = report.findings[i];
      md += `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n\n`;
      md += `**Agent:** ${f.agent}`;
      if (f.line) md += ` | **Line:** ${f.line}`;
      md += `\n\n${f.description}\n\n`;
      if (f.recommendation) md += `> **Recommendation:** ${f.recommendation}\n\n`;
    }
  }

  // Agent Performance
  md += `---\n\n## Agent Performance\n\n`;
  md += `| Agent | Status | Findings |\n|-------|--------|----------|\n`;
  for (const ar of report.agentResults) {
    md += `| ${ar.agentName} | ${ar.findingCount > 0 ? '⚠ Findings' : '✓ Clear'} | ${ar.findingCount} |\n`;
  }
  md += `\n`;

  md += `---\n\n## Recommendation\n\n${report.recommendation}\n\n`;
  md += `---\n\n*Generated by Pentagonal — Smart Contract Forge · ${new Date(report.timestamp).toLocaleString()}*\n`;
  return md;
}

export default function Home() {
  // ─── Core State ───
  const [appState, setAppState] = useState<AppState>('landing');
  const [mode, setMode] = useState<Mode>('create');
  const [chain, setChain] = useState<Chain>(CHAINS[0]);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [learningOn, setLearningOn] = useState(true);
  const [solanaType, setSolanaType] = useState<SolanaType>('token');
  const [showSolanaExplainer, setShowSolanaExplainer] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [rulesCount, setRulesCount] = useState(0);
  const [rulesList, setRulesList] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);

  // ─── Auth State ───
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [paymentPackId, setPaymentPackId] = useState('single');
  const [showCreditTooltip, setShowCreditTooltip] = useState(false);
  const supabase = createClient();

  // ─── Credits ───
  const creditActions = useCredits(user?.id);
  const totalCredits = creditActions.credits;

  // ─── Scoping State ───
  const [scopeMessages, setScopeMessages] = useState<ScopeMessage[]>([]);
  const [isScopeLoading, setIsScopeLoading] = useState(false);
  const scopeEndRef = useRef<HTMLDivElement>(null);

  // ─── Code State ───
  const [code, setCode] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileName, setFileName] = useState('Contract.sol');

  // ─── Hover Explanation ───
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ title: string; explanation: string; line: number } | null>(null);
  const tooltipCache = useRef<Map<string, { title: string; explanation: string }>>(new Map());

  // ─── Token Info ───
  interface TokenInfo {
    found: boolean;
    name?: string;
    symbol?: string;
    priceUsd?: string;
    priceChange24h?: number;
    volume24h?: number;
    txns24h?: number;
    buys24h?: number;
    sells24h?: number;
    liquidity?: number;
    marketCap?: number;
    pairCount?: number;
    dexName?: string;
    imageUrl?: string;
    url?: string;        // link to top pool on DexScreener
    message?: string;
    // Enriched fields from Rugcheck (Solana)
    rugScore?: number;
    rugged?: boolean;
    launchpad?: string;
    totalHolders?: number;
    lpLockedPct?: number;
    insidersDetected?: number;
    creatorPct?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    // Enriched flags from GoPlus (EVM)
    isHoneypot?: boolean;
    buyTax?: number;
    sellTax?: number;
    isMintable?: boolean;
    isPausable?: boolean;
    hiddenOwner?: boolean;
    ownerPct?: number;
    lpUnlockedPct?: number;
    canTakeBack?: boolean;
    selfDestruct?: boolean;
    // Links
    dexUrl?: string;
    holderUrl?: string;
    // ATH
    athMarketCap?: number | null;
    athMultiplier?: number | null;
    athLabel?: string;
  }
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // ─── Audit State ───
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS.map(a => ({ ...a })));
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [showDeployHistory, setShowDeployHistory] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [caCopied, setCaCopied] = useState(false);

  // ─── Address Fetch State ───
  const [addressInput, setAddressInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isDetectingChain, setIsDetectingChain] = useState(false);
  const detectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Q&A State ───
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);

  // ─── Refs ───
  const codeBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chainDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-scroll code body during streaming
  useEffect(() => {
    if (isStreaming && codeBodyRef.current) {
      codeBodyRef.current.scrollTop = codeBodyRef.current.scrollHeight;
    }
  }, [code, isStreaming]);

  // Close chain dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(e.target as Node)) {
        setShowChainDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch rules count on mount
  useEffect(() => {
    fetch('/api/rules-count').then(r => r.json()).then(d => {
      setRulesCount(d.count || 0);
      setRulesList(d.rules || []);
    }).catch(() => {});
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  // Auth state listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Auto-scroll scope messages
  useEffect(() => {
    if (scopeEndRef.current) {
      scopeEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scopeMessages]);

  // ─── Start Scoping ───
  const startScoping = useCallback(async (initialPrompt: string) => {
    setAppState('scoping');
    setCurrentPrompt(initialPrompt);
    setIsScopeLoading(true);
    setScopeMessages([{ role: 'user', content: initialPrompt }]);
    setPrompt('');

    try {
      const res = await fetch('/api/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPrompt, chain: chain.id }),
      });
      const data = await res.json();

      const aiMsg: ScopeMessage = {
        role: 'assistant',
        content: data.question || data.summary || '',
        buttons: data.buttons,
        multiSelect: data.multiSelect,
        inputNeeded: data.inputNeeded,
        isConfirmation: data.confirmed,
        generationPrompt: data.generationPrompt,
      };
      setScopeMessages(prev => [...prev, aiMsg]);
    } catch {
      setScopeMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    }
    setIsScopeLoading(false);
  }, [chain]);

  // ─── Send scope response (typed or button) ───
  const sendScopeResponse = useCallback(async (userResponse: string) => {
    const newUserMsg: ScopeMessage = { role: 'user', content: userResponse };
    const updatedMessages = [...scopeMessages, newUserMsg];
    setScopeMessages(updatedMessages);
    setIsScopeLoading(true);
    setPrompt('');

    // Build history for API
    const history = updatedMessages.map(m => ({
      role: m.role,
      content: m.role === 'assistant' && m.buttons
        ? JSON.stringify({ question: m.content, buttons: m.buttons, multiSelect: m.multiSelect })
        : m.content,
    }));

    try {
      const res = await fetch('/api/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, chain: chain.id }),
      });
      const data = await res.json();

      const aiMsg: ScopeMessage = {
        role: 'assistant',
        content: data.question || data.summary || '',
        buttons: data.buttons,
        multiSelect: data.multiSelect,
        inputNeeded: data.inputNeeded,
        isConfirmation: data.confirmed,
        generationPrompt: data.generationPrompt,
      };
      setScopeMessages(prev => [...prev, aiMsg]);
    } catch {
      setScopeMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    }
    setIsScopeLoading(false);
  }, [scopeMessages, chain]);

  // ─── Handle button click in scoping ───
  const handleScopeButton = useCallback((button: ScopeButton, msgIndex: number, multiSelect?: boolean) => {
    if (multiSelect) {
      // Toggle selection
      setScopeMessages(prev => prev.map((m, i) => {
        if (i !== msgIndex || !m.buttons) return m;
        return {
          ...m,
          buttons: m.buttons.map(b =>
            b.value === button.value ? { ...b, selected: !b.selected } : b
          ),
        };
      }));
    } else {
      // Single select → send immediately
      sendScopeResponse(button.label);
    }
  }, [sendScopeResponse]);

  // ─── Confirm multi-select ───
  const confirmMultiSelect = useCallback((msgIndex: number) => {
    const msg = scopeMessages[msgIndex];
    if (!msg?.buttons) return;
    const selected = msg.buttons.filter(b => b.selected).map(b => b.label);
    sendScopeResponse(selected.length > 0 ? selected.join(', ') : 'None');
  }, [scopeMessages, sendScopeResponse]);

  // ─── Generate from scope (after confirmation) ───
  const generateFromScope = useCallback(async (genPrompt: string) => {
    setCode('');
    setFindings([]);
    setAgents(DEFAULT_AGENTS.map(a => ({ ...a })));
    setReport(null);
    setShowReport(false);
    setIsStreaming(true);
    setAppState('streaming');
    setQaAnswer('');
    setScopeMessages([]);

    const nameMatch = genPrompt.match(/called?\s+(\w+)/i);
    const ext = chain.type === 'solana' ? '.rs' : '.sol';
    setFileName(nameMatch ? nameMatch[1] + ext : 'Contract' + ext);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, chain: chain.id, learningOn, solanaType: chain.type === 'solana' ? solanaType : undefined }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setCode((prev) => prev + data.text);
              } else if (data.done) {
                setIsStreaming(false);
                setAppState('complete');
              } else if (data.error) {
                setIsStreaming(false);
                setAppState('complete');
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setIsStreaming(false);
      setAppState('complete');
    }
  }, [chain, learningOn]);

  // ─── Generate Contract (direct, for Q&A refinements) ───
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isStreaming) return;

    const currentInput = prompt;
    setCurrentPrompt(currentInput);
    setCode('');
    setFindings([]);
    setAgents(DEFAULT_AGENTS.map(a => ({ ...a })));
    setReport(null);
    setShowReport(false);
    setIsStreaming(true);
    setAppState('streaming');
    setQaAnswer('');

    const nameMatch = currentInput.match(/called?\s+(\w+)/i);
    const ext = chain.type === 'solana' ? '.rs' : '.sol';
    setFileName(nameMatch ? nameMatch[1] + ext : 'Contract' + ext);
    setPrompt('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentInput, chain: chain.id, learningOn, solanaType: chain.type === 'solana' ? solanaType : undefined }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setCode((prev) => prev + data.text);
              } else if (data.done) {
                setIsStreaming(false);
                setAppState('complete');
              } else if (data.error) {
                setIsStreaming(false);
                setAppState('complete');
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setIsStreaming(false);
      setAppState('complete');
    }
  }, [prompt, chain, learningOn, isStreaming]);

  // ─── Fetch on-chain contract ───
  const handleFetchContract = useCallback(async () => {
    if (!addressInput.trim() || isFetching) return;

    setIsFetching(true);
    setFetchError('');
    setTokenInfo(null);
    setFindings([]);
    setReport(null);
    setShowReport(false);

    try {
      const res = await fetch('/api/fetch-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressInput.trim(), chainId: chain.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error || 'Failed to fetch contract');
        setIsFetching(false);
        return;
      }

      if (!data.code) {
        setFetchError(data.message || 'No source code available');
        setIsFetching(false);
        return;
      }

      setCode(data.code);
      setFileName(data.name + '.sol');
      setCurrentPrompt(`On-chain audit: ${data.name} (${addressInput.trim()})`);
      setIsFetching(false);

      // Populate token info from the enriched fetch-contract response
      const ti = data.tokenInfo;
      if (ti) {
        setTokenInfo({
          found: true,
          name: ti.name,
          symbol: ti.symbol,
          imageUrl: ti.imageUrl,
          // Market data
          priceUsd: ti.priceUsd,
          priceChange24h: ti.priceChange24h,
          volume24h: ti.volume24h,
          txns24h: ti.txns24h,
          buys24h: ti.buys24h,
          sells24h: ti.sells24h,
          liquidity: ti.liquidity,
          marketCap: ti.marketCap,
          pairCount: ti.pairCount,
          dexName: ti.dexName,
          url: ti.url,
          // Socials
          website: ti.website,
          twitter: ti.twitter,
          telegram: ti.telegram,
          // Solana-specific
          rugScore: ti.rugScore,
          rugged: ti.rugged,
          launchpad: ti.launchpad,
          totalHolders: ti.totalHolders,
          lpLockedPct: ti.lpLockedPct,
          insidersDetected: ti.insidersDetected,
          creatorPct: ti.creatorPct,
          // EVM-specific (GoPlus)
          isHoneypot: ti.isHoneypot,
          buyTax: ti.buyTax != null ? Number(ti.buyTax) : undefined,
          sellTax: ti.sellTax != null ? Number(ti.sellTax) : undefined,
          isMintable: ti.isMintable,
          isPausable: ti.isPausable,
          hiddenOwner: ti.hiddenOwner,
          ownerPct: ti.ownerPct != null ? Number(ti.ownerPct) : undefined,
          lpUnlockedPct: ti.lpUnlockedPct != null ? Number(ti.lpUnlockedPct) : undefined,
          canTakeBack: ti.canTakeBack,
          selfDestruct: ti.selfDestruct,
          // Links
          dexUrl: ti.dexUrl,
          holderUrl: ti.holderUrl,
          // ATH
          athMarketCap: ti.athMarketCap,
          athMultiplier: ti.athMultiplier,
          athLabel: ti.athLabel,
        });
      }

      // Go to token-preview state — user clicks "Run Audit" to start
      setAppState('token-preview');
    } catch {
      setFetchError('Network error fetching contract');
      setIsFetching(false);
    }
  }, [addressInput, chain, isFetching]);

  // ─── Run step-by-step audit ───
  const startAudit = useCallback(async (codeToAudit?: string) => {
    const auditCode = codeToAudit || code;
    if (!auditCode.trim() || isAuditing) return;

    setIsAuditing(true);
    setAppState('auditing');
    setFindings([]);
    setReport(null);
    setShowReport(false);
    setAuditProgress(0);
    setAuditError(null);
    setQaAnswer('');

    // Reset agents to queued
    setAgents(DEFAULT_AGENTS.map(a => ({ ...a, status: 'queued' as const, findingCount: 0, findings: [] })));

    try {
      const res = await fetch('/api/audit-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: auditCode, chain: chain.id, learningOn }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Audit agent error:', errData);
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let completedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'agent-start') {
                setAgents(prev => prev.map(a =>
                  a.id === data.agentId ? { ...a, status: 'scanning' as const } : a
                ));
              }

              if (data.type === 'agent-complete') {
                completedCount++;
                setAuditProgress(completedCount);

                const agentFindings: Finding[] = (data.findings || []).map((f: Finding, i: number) => ({
                  ...f,
                  id: `${data.agentId}-${i}`,
                }));

                setAgents(prev => prev.map(a =>
                  a.id === data.agentId ? {
                    ...a,
                    status: data.findingCount > 0
                      ? (agentFindings.some(f => f.severity === 'critical') ? 'critical' as const : 'finding' as const)
                      : 'clear' as const,
                    findingCount: data.findingCount,
                    findings: agentFindings,
                  } : a
                ));

                setFindings(prev => [...prev, ...agentFindings]);

                // All agents done — start synthesizing phase
                if (completedCount >= DEFAULT_AGENTS.length) {
                  setGeneratingReport(true);
                  setShowReport(true);
                }
              }

              if (data.type === 'agent-error') {
                completedCount++;
                setAuditProgress(completedCount);
                setAgents(prev => prev.map(a =>
                  a.id === data.agentId ? { ...a, status: 'clear' as const } : a
                ));
                // Count error'd agents toward completion too
                if (completedCount >= DEFAULT_AGENTS.length) {
                  setGeneratingReport(true);
                  setShowReport(true);
                }
              }

              if (data.type === 'audit-complete') {
                const reportData: AuditReport = {
                  ...data.report,
                  contractName: tokenInfo?.name ? `${tokenInfo.name} (${tokenInfo.symbol})` : fileName,
                };
                setGeneratingReport(false);
                setReport(reportData);
                setIsAuditing(false);
                setAppState('audit-complete');
                // Refresh rules count after audit (new rules may have been extracted)
                fetch('/api/rules-count').then(r => r.json()).then(d => {
                  setRulesCount(d.count || 0);
                  setRulesList(d.rules || []);
                }).catch(() => {});
              }

              // ── Handle server-side stream errors ──
              if (data.type === 'error') {
                setAuditError(data.error as string || 'Audit failed on server');
                setIsAuditing(false);
                setAppState('auditing');
              }

              // ── Handle server debug messages ──
              if (data.type === 'debug') {
                setAuditError(`[Server debug] ${data.message as string}`);
              }
            } catch { /* skip malformed SSE line */ }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAuditError(msg);
      setIsAuditing(false);
      setAppState('auditing');
    }
  }, [code, chain, learningOn, isAuditing, fileName]);

  // ─── Ask about code ───
  const handleAsk = useCallback(async () => {
    if (!prompt.trim() || !code || qaLoading) return;

    setQaLoading(true);
    setQaAnswer('');
    const question = prompt;
    setPrompt('');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, question }),
      });
      const data = await res.json();
      setQaAnswer(data.answer || 'No answer available.');
    } catch {
      setQaAnswer('Failed to get answer.');
    }
    setQaLoading(false);
  }, [prompt, code, qaLoading]);

  // ─── Handle Submit ───
  const handleSubmit = useCallback(() => {
    // Auth gate — allow scoping questions through but gate actions
    if (appState === 'scoping') {
      if (prompt.trim()) sendScopeResponse(prompt);
      return;
    }
    // Gate: require auth for create/audit actions from landing
    if (!user && appState === 'landing') {
      setShowSignInModal(true);
      return;
    }
    if (mode === 'create') {
      if (appState === 'landing') {
        // Credit gate: creation
        if (user && !creditActions.hasCredits()) {
          setPaymentPackId('single');
          setShowPaymentModal(true);
          return;
        }
        startScoping(prompt);
      } else {
        handleGenerate();
      }
    } else {
      if (prompt.trim() && code) {
        handleAsk(); // Q&A is free
      } else if (code) {
        // Credit gate: audit
        if (user && !creditActions.hasCredits()) {
          setPaymentPackId('single');
          setShowPaymentModal(true);
          return;
        }
        startAudit();
      }
    }
  }, [appState, mode, prompt, code, user, handleGenerate, handleAsk, startAudit, startScoping, sendScopeResponse, creditActions]);

  // ─── Hover explanation ───
  const handleLineHover = useCallback(async (lineNum: number) => {
    if (isStreaming || !code) return;
    setHoveredLine(lineNum);

    const cacheKey = `${lineNum}-${lineNum + 4}`;
    const cached = tooltipCache.current.get(cacheKey);
    if (cached) { setTooltip({ ...cached, line: lineNum }); return; }

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, startLine: lineNum, endLine: Math.min(lineNum + 4, code.split('\n').length) }),
      });
      const data = await res.json();
      if (data.title) {
        tooltipCache.current.set(cacheKey, data);
        setTooltip({ ...data, line: lineNum });
      }
    } catch { /* quiet */ }
  }, [code, isStreaming]);

  // ─── Auto-fix ───
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());

  const handleFix = useCallback(async (finding: Finding, skipCreditCheck?: boolean) => {
    if (fixingIds.has(finding.id)) return;
    // Credit gate: edit (skip if called from batch which already checked)
    if (!skipCreditCheck && user && !creditActions.hasCredits()) {
      setPaymentPackId('single');
      setShowPaymentModal(true);
      return;
    }
    setFixingIds(prev => new Set(prev).add(finding.id));
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          finding: { title: finding.title, description: finding.description, line: finding.line },
        }),
      });
      const data = await res.json();
      if (data.error) {
        console.error(`[FIX] Failed for "${finding.title}":`, data.error);
      } else if (data.code) {
        setCode(data.code);
        setFindings(prev => prev.map(f => f.id === finding.id ? { ...f, fixed: true } : f));
      }
    } catch (err) {
      console.error('[FIX] Request failed:', err);
    } finally {
      setFixingIds(prev => { const next = new Set(prev); next.delete(finding.id); return next; });
    }
  }, [code, fixingIds]);

  const handleFixBySeverity = useCallback(async (severity: string) => {
    // Credit gate: 1 edit credit per severity batch
    if (user && !creditActions.hasCredits()) {
      setPaymentPackId('single');
      setShowPaymentModal(true);
      return;
    }
    const toFix = findings.filter(f => !f.fixed && f.severity === severity);
    for (const finding of toFix) {
      await handleFix(finding, true);
    }
  }, [findings, handleFix, user, creditActions]);

  const handleFixAll = useCallback(async () => {
    // Credit gate: 1 edit credit for "fix all" action
    if (user && !creditActions.hasCredits()) {
      setPaymentPackId('single');
      setShowPaymentModal(true);
      return;
    }
    const toFix = findings.filter(f => !f.fixed);
    for (const finding of toFix) {
      await handleFix(finding, true);
    }
  }, [findings, handleFix, user, creditActions]);

  // ─── Magic prompt expansion ───
  const handleMagicExpand = useCallback(async () => {
    if (!prompt.trim() || isExpanding) return;
    setIsExpanding(true);
    try {
      const res = await fetch('/api/expand-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), chain: chain.id }),
      });
      const data = await res.json();
      if (data.expanded) {
        setPrompt(data.expanded);
        // Auto-resize textarea after content change
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
          }
        }, 50);
      }
    } catch (err) {
      console.error('Magic expand failed:', err);
    } finally {
      setIsExpanding(false);
    }
  }, [prompt, chain, isExpanding]);

  // ─── Download report as branded PDF ───
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadReport = useCallback(async () => {
    if (!report || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    // Ensure the report panel is visible so reportRef is mounted in the DOM
    if (!showReport) {
      setShowReport(true);
      // Wait two frames for React to render + mount the ref
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!reportRef.current) {
      setIsGeneratingPdf(false);
      alert('Report panel not ready. Please click "Report" to view it first, then try again.');
      return;
    }

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;

      // ─── Page 1: Branded Cover Page ───
      const coverDiv = document.createElement('div');
      coverDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;';
      
      const scoreColor = report.riskScore >= 80 ? '#22c55e' : report.riskScore >= 60 ? '#eab308' : report.riskScore >= 40 ? '#f97316' : '#ef4444';
      const riskLabel = report.riskScore >= 80 ? 'Low Risk' : report.riskScore >= 60 ? 'Medium Risk' : report.riskScore >= 40 ? 'High Risk' : 'Critical Risk';
      const criticals = report.findings.filter(f => f.severity === 'critical').length;
      const highs = report.findings.filter(f => f.severity === 'high').length;
      const mediums = report.findings.filter(f => f.severity === 'medium').length;
      const lows = report.findings.filter(f => f.severity === 'low').length;
      const dateStr = new Date(report.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      coverDiv.innerHTML = `
        <div style="width:794px;height:1123px;background:linear-gradient(160deg,#0f0a2e 0%,#1e1254 40%,#312e81 70%,#4338ca 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;color:white;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 30% 20%,rgba(99,102,241,0.15) 0%,transparent 50%),radial-gradient(circle at 70% 80%,rgba(79,70,229,0.1) 0%,transparent 50%);"></div>
          
          <div style="position:relative;z-index:1;text-align:center;padding:0 60px;">
            <svg viewBox="0 0 80 80" width="80" height="80" style="margin-bottom:32px;">
              <polygon points="40,4 76,28 62,68 18,68 4,28" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
              <polygon points="40,12 66,32 55,62 25,62 14,32" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
              <circle cx="40" cy="40" r="6" fill="rgba(255,255,255,0.9)"/>
            </svg>
            
            <div style="font-size:14px;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:16px;">PENTAGONAL</div>
            <div style="font-size:42px;font-weight:700;letter-spacing:-0.5px;margin-bottom:8px;">Security Audit Report</div>
            <div style="width:60px;height:2px;background:rgba(255,255,255,0.3);margin:24px auto;"></div>

            <div style="margin-top:40px;text-align:left;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:28px 36px;backdrop-filter:blur(10px);">
              <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
                <span style="color:rgba(255,255,255,0.5);font-size:13px;">Contract</span>
                <span style="font-size:14px;font-weight:600;">${report.contractName}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
                <span style="color:rgba(255,255,255,0.5);font-size:13px;">Chain</span>
                <span style="font-size:14px;font-weight:600;">${report.chain}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
                <span style="color:rgba(255,255,255,0.5);font-size:13px;">Date</span>
                <span style="font-size:14px;font-weight:600;">${dateStr}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:rgba(255,255,255,0.5);font-size:13px;">Rules Applied</span>
                <span style="font-size:14px;font-weight:600;">${report.rulesApplied}</span>
              </div>
            </div>

            <div style="margin-top:48px;display:flex;align-items:center;justify-content:center;gap:24px;">
              <div style="text-align:center;">
                <div style="width:100px;height:100px;border-radius:50%;border:3px solid ${scoreColor};display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);">
                  <div>
                    <div style="font-size:32px;font-weight:700;color:${scoreColor};">${report.riskScore}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:-2px;">/100</div>
                  </div>
                </div>
                <div style="margin-top:8px;font-size:12px;font-weight:600;color:${scoreColor};">${riskLabel}</div>
              </div>
              <div style="display:flex;gap:12px;">
                <div style="text-align:center;padding:10px 16px;border-radius:8px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);">
                  <div style="font-size:22px;font-weight:700;color:#ef4444;">${criticals}</div>
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-top:2px;">Critical</div>
                </div>
                <div style="text-align:center;padding:10px 16px;border-radius:8px;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.3);">
                  <div style="font-size:22px;font-weight:700;color:#f97316;">${highs}</div>
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-top:2px;">High</div>
                </div>
                <div style="text-align:center;padding:10px 16px;border-radius:8px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.3);">
                  <div style="font-size:22px;font-weight:700;color:#eab308;">${mediums}</div>
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-top:2px;">Medium</div>
                </div>
                <div style="text-align:center;padding:10px 16px;border-radius:8px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);">
                  <div style="font-size:22px;font-weight:700;color:#22c55e;">${lows}</div>
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);margin-top:2px;">Low</div>
                </div>
              </div>
            </div>
          </div>

          <div style="position:absolute;bottom:40px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;">
            Generated by Pentagonal — Autonomous AI Security Auditing
          </div>
        </div>
      `;
      document.body.appendChild(coverDiv);

      // Capture cover page
      const coverCanvas = await html2canvas(coverDiv.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 794,
        height: 1123,
      });
      document.body.removeChild(coverDiv);

      const coverImg = coverCanvas.toDataURL('image/png');
      pdf.addImage(coverImg, 'PNG', 0, 0, pageW, pageH);

      // ─── Remaining pages: Report content ───
      const reportEl = reportRef.current;
      const reportCanvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: reportEl.scrollWidth,
      });

      const imgW = pageW - 20; // 10mm margins
      const imgH = (reportCanvas.height * imgW) / reportCanvas.width;
      const pageContentH = pageH - 20; // 10mm top/bottom margins
      let yOffset = 0;
      let pageNum = 1;

      while (yOffset < imgH) {
        pdf.addPage();
        pageNum++;

        // Slice the canvas for this page
        const sliceH = Math.min(pageContentH, imgH - yOffset);
        const sliceCanvas = document.createElement('canvas');
        const sliceRatio = reportCanvas.width / imgW;
        sliceCanvas.width = reportCanvas.width;
        sliceCanvas.height = sliceH * sliceRatio;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            reportCanvas,
            0, yOffset * sliceRatio,
            reportCanvas.width, sliceH * sliceRatio,
            0, 0,
            sliceCanvas.width, sliceCanvas.height,
          );
        }

        const sliceImg = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceImg, 'PNG', 10, 10, imgW, sliceH);

        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Pentagonal Security Audit — ${report.contractName}`, 10, pageH - 6);
        pdf.text(`Page ${pageNum}`, pageW - 20, pageH - 6);

        yOffset += pageContentH;
      }

      // Save
      const safeName = report.contractName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      pdf.save(`${safeName}-Security-Audit.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Check console for details.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [report, isGeneratingPdf, showReport]);


  // ─── Key handler ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'audit' && appState === 'landing' && addressInput.trim()) {
        handleFetchContract();
      } else if (appState === 'scoping' && prompt.trim()) {
        sendScopeResponse(prompt);
      } else {
        handleSubmit();
      }
    }
  };

  // ─── Render helpers ───
  const codeLines = code.split('\n');
  const isActive = appState !== 'landing';
  const isScopingView = appState === 'scoping';
  const isTokenPreview = appState === 'token-preview';
  const isAuditView = appState === 'auditing' || appState === 'audit-complete';
  const progressPercent = Math.round((auditProgress / DEFAULT_AGENTS.length) * 100);

  return (
    <>
      {/* ─── Header ─── */}
      <header className="header">
        <div className="header-logo" onClick={() => {
          setAppState('landing');
          setCode('');
          setFindings([]);
          setReport(null);
          setShowReport(false);
          setCurrentPrompt('');
          setAddressInput('');
          setFetchError('');
          setScopeMessages([]);
          setAgents(DEFAULT_AGENTS.map(a => ({ ...a })));
        }} style={{ cursor: 'pointer' }}>
          <PentagonMark size={24} />
          Pentagonal
          <a href="https://x.com/Pentagonalai" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px', color: 'var(--text-secondary)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="header-ai-btns">
            <button className="header-ai-btn npm" onClick={() => { navigator.clipboard.writeText('npx -y pentagonal-mcp'); const btn = document.getElementById('npm-copy-btn'); if (btn) { btn.textContent = '✓ copied'; setTimeout(() => { btn.textContent = 'npx pentagonal-mcp'; }, 1500); } }} id="npm-copy-btn">npx pentagonal-mcp</button>
            <button className="header-ai-btn mcp" onClick={() => { document.getElementById('ai-integration')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>⬡ MCP</button>
            <button className="header-ai-btn skill" onClick={() => { document.getElementById('ai-integration')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>/SKILL</button>
          </div>
          {rulesCount > 0 && (
            <div style={{ position: 'relative' }}>
              <button className="rules-counter" onClick={() => setShowRules(!showRules)}>
                {rulesCount} rules learned
              </button>
              {showRules && (
                <div className="rules-dropdown">
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6366f1', marginBottom: '8px' }}>Learned Rules</div>
                  <div className="rules-list">
                    {rulesList.map((rule, i) => (
                      <div key={i} className="rules-item">{rule}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="learning-toggle" onClick={() => setLearningOn(!learningOn)}>
            <span>Learning</span>
            <div className={`toggle-pill ${learningOn ? 'on' : ''}`} />
          </div>
          <ThemeToggle />
          {user ? (
            <>
              {/* Credit badge */}
              <div style={{ position: 'relative' }}>
                <button
                  className="credit-badge"
                  onClick={() => setShowCreditTooltip(!showCreditTooltip)}
                  title="Your credits"
                >
                  {totalCredits} 🎫
                </button>
                {showCreditTooltip && (
                  <div className="credit-tooltip">
                    <div className="credit-tooltip-row"><span>Credits</span><strong>{creditActions.credits}</strong></div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: 2 }}>Works for Create, Audit, or Edit</div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="pm-pay-btn"
                        style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setShowCreditTooltip(false);
                          setPaymentPackId('pack_5');
                          setShowPaymentModal(true);
                        }}
                      >
                        Buy Credits
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* User avatar */}
              <div style={{ position: 'relative' }}>
                <button className="user-avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    (user.email?.[0] || 'U').toUpperCase()
                  )}
                </button>
                {showUserMenu && (
                  <div className="user-menu">
                    <div className="user-menu-email">{user.email}</div>
                    <button className="user-menu-item" onClick={() => {
                      setShowApiKeysModal(true);
                      setShowUserMenu(false);
                    }}>
                      🔑 API Keys
                    </button>
                    <button className="user-menu-item danger" onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a href="/login" className="signin-header-btn">
              Sign In →
            </a>
          )}
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="main">
        <div className="content">

          {/* ═══════════════════════════════════════ */}
          {/* ─── LANDING STATE ─── */}
          {/* ═══════════════════════════════════════ */}
          {!isActive && (
            <div className="landing">
              <div className="landing-hero">
                <h1 className="hero-text">
                  {mode === 'create' ? 'Describe your function' : 'What would you like to audit?'}
                </h1>

                <div className="prompt-container">
                <div className="prompt-box">
                  {/* Audit mode: address input */}
                  {mode === 'audit' ? (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="address-input"
                          placeholder="Paste contract address (0x...) or paste code below"
                          value={addressInput}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setAddressInput(e.target.value);
                            setFetchError('');

                            // Auto-detect chain when a valid address is pasted
                            if (detectTimeout.current) clearTimeout(detectTimeout.current);

                            // Solana: base58, 32-44 chars, no 0x prefix
                            if (val.length >= 32 && val.length <= 44 && !val.startsWith('0x') && /^[A-HJ-NP-Za-km-z1-9]+$/.test(val)) {
                              const solChain = CHAINS.find(c => c.id === 'solana');
                              if (solChain) setChain(solChain);
                              return;
                            }

                            // EVM: 0x + 40 hex chars — detect chain via DexScreener
                            if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
                              setIsDetectingChain(true);
                              detectTimeout.current = setTimeout(async () => {
                                try {
                                  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${val}`);
                                  const data = await res.json();
                                  const pairs = data?.pairs || [];
                                  if (pairs.length > 0) {
                                    // Find the chain with most liquidity
                                    const chainLiq: Record<string, number> = {};
                                    for (const p of pairs) {
                                      chainLiq[p.chainId] = (chainLiq[p.chainId] || 0) + (p.liquidity?.usd || 0);
                                    }
                                    const topChain = Object.entries(chainLiq).sort((a, b) => b[1] - a[1])[0]?.[0];
                                    if (topChain) {
                                      const match = CHAINS.find(c => c.id === topChain);
                                      if (match) setChain(match);
                                    }
                                  }
                                } catch { /* detection failed silently */ }
                                setIsDetectingChain(false);
                              }, 300);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleFetchContract(); }}
                          spellCheck={false}
                        />
                        <button
                          className="submit-btn"
                          onClick={handleFetchContract}
                          disabled={!addressInput.trim() || isFetching || isDetectingChain}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {isDetectingChain ? 'Detecting...' : isFetching ? 'Analyzing...' : 'Analyze →'}
                        </button>
                      </div>
                      {fetchError && (
                        <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{fetchError}</div>
                      )}
                      <div style={{ borderTop: '1px solid #e2e8f0', margin: '12px 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '0 12px', fontSize: '12px', color: '#94a3b8' }}>or paste code</span>
                      </div>
                      <textarea
                        className="prompt-textarea"
                        placeholder="Paste smart contract code here..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={4}
                        style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                      />
                    </div>
                  ) : (
                    <textarea
                      ref={textareaRef}
                      className="prompt-textarea"
                      placeholder="Describe your smart contract..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={3}
                    />
                  )}

                  {/* ─── Solana Type Selector (shown only when Solana + Create mode) ─── */}
                  {chain.type === 'solana' && mode === 'create' && (
                    <div className="solana-type-selector">
                      <div className="solana-type-header">
                        <span className="solana-type-label">Solana Deployment Type</span>
                        <button
                          className="solana-explainer-toggle"
                          onClick={() => setShowSolanaExplainer(!showSolanaExplainer)}
                        >
                          {showSolanaExplainer ? 'Hide details ▲' : 'What\'s the difference? ▼'}
                        </button>
                      </div>
                      <div className="solana-type-cards">
                        <button
                          className={`solana-type-card ${solanaType === 'token' ? 'selected' : ''}`}
                          onClick={() => setSolanaType('token')}
                        >
                          <span className="solana-type-icon">🪙</span>
                          <span className="solana-type-name">Token (SPL)</span>
                          <span className="solana-type-desc">Create a fungible token<br/>Quick &amp; low-cost</span>
                          <span className="solana-type-badge">~0.01 SOL</span>
                        </button>
                        <button
                          className={`solana-type-card ${solanaType === 'program' ? 'selected' : ''}`}
                          onClick={() => setSolanaType('program')}
                        >
                          <span className="solana-type-icon">⚙️</span>
                          <span className="solana-type-name">Program (Anchor)</span>
                          <span className="solana-type-desc">Full on-chain program<br/>Advanced &amp; customizable</span>
                          <span className="solana-type-badge program">1–5+ SOL</span>
                        </button>
                      </div>
                      {showSolanaExplainer && (
                        <div className="solana-explainer">
                          <div className="solana-explainer-row">
                            <div className="solana-explainer-col">
                              <h4>🪙 SPL Token</h4>
                              <ul>
                                <li>Creates a standard fungible token on Solana</li>
                                <li>Deployed instantly from your browser</li>
                                <li>Costs ~0.01 SOL (rent + fees)</li>
                                <li>Perfect for community tokens, memecoins, or reward systems</li>
                                <li>No coding experience needed</li>
                              </ul>
                            </div>
                            <div className="solana-explainer-col">
                              <h4>⚙️ Anchor Program</h4>
                              <ul>
                                <li>A custom on-chain program (smart contract equivalent)</li>
                                <li>Requires Anchor CLI + local Rust toolchain to compile</li>
                                <li>Costs 1–5+ SOL for deployment (rent-exempt data)</li>
                                <li>For DeFi protocols, DAOs, NFT logic, games</li>
                                <li>AI generates code — you deploy via Solana Playground or CLI</li>
                              </ul>
                            </div>
                          </div>
                          <div className="solana-explainer-warning">
                            ⚠️ Programs require significant investment in SOL for deployment and cannot be easily modified after deployment. Start with a token if you&apos;re exploring.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="prompt-controls">
                    <div className="prompt-tabs">
                      <button
                        className={`prompt-tab ${mode === 'create' ? 'active' : ''}`}
                        onClick={() => setMode('create')}
                      >
                        ⚡ Create
                      </button>
                      <button
                        className={`prompt-tab ${mode === 'audit' ? 'active' : ''}`}
                        onClick={() => setMode('audit')}
                      >
                        🔍 Audit
                      </button>
                      <div ref={chainDropdownRef} style={{ position: 'relative' }}>
                        <button
                          className="chain-selector"
                          onClick={() => setShowChainDropdown(!showChainDropdown)}
                        >
                          <span>{chain.icon}</span>
                          <span>{chain.name}</span>
                          <span style={{ fontSize: '10px' }}>▾</span>
                        </button>
                        {showChainDropdown && (
                          <div className="chain-dropdown">
                            {CHAINS.map((c) => (
                              <button
                                key={c.id}
                                className={`chain-option ${c.id === chain.id ? 'selected' : ''}`}
                                onClick={() => { setChain(c); setShowChainDropdown(false); }}
                              >
                                <span>{c.icon}</span>
                                <span>{c.name}</span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {c.type === 'solana' ? 'Rust' : 'Solidity'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="prompt-right">
                      {mode === 'create' && prompt.trim() && (
                        <button
                          className="magic-btn"
                          onClick={handleMagicExpand}
                          disabled={isExpanding || !prompt.trim()}
                          title="Expand prompt with AI"
                        >
                          {isExpanding ? (
                            <span className="magic-spinner">⟳</span>
                          ) : (
                            '✦'
                          )}
                        </button>
                      )}
                      {mode === 'audit' && prompt.trim() ? (
                        <button
                          className="submit-btn"
                          onClick={() => {
                            setCode(prompt);
                            setCurrentPrompt('Manual code audit');
                            setFileName('Contract.sol');
                            setPrompt('');
                            startAudit(prompt);
                          }}
                        >
                          Audit Code →
                        </button>
                      ) : mode === 'create' ? (
                        <button
                          className="submit-btn"
                          onClick={handleSubmit}
                          disabled={!prompt.trim()}
                        >
                          Generate →
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scroll CTA */}
              <button className="scroll-cta" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Learn more ↓
              </button>
              </div>

              {/* Marketing Sections */}
              <div className="marketing-sections">
                <FeaturePillars />
                <SelfLearningSection rulesCount={rulesCount} />
                <ChainShowcase />
                <AuditDemo />
                <PricingSection onGetStarted={(packId) => {
                  if (!user) {
                    setShowSignInModal(true);
                    return;
                  }
                  setPaymentPackId(packId);
                  setShowPaymentModal(true);
                }} />
                <div id="ai-integration">
                  <MCPSetupSection />
                </div>
              </div>
              <Footer />
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ─── SCOPING CONVERSATION ─── */}
          {/* ═══════════════════════════════════════ */}
          {isScopingView && (
            <div className="session">
              <div className="scope-thread">
                {scopeMessages.map((msg, idx) => (
                  <div key={idx} className={`scope-msg ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="scope-avatar">⬠</div>
                    )}
                    <div className="scope-bubble">
                      {msg.isConfirmation ? (
                        <div className="scope-confirmation">
                          <div className="scope-confirm-label">Scope Confirmed</div>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.7' }}>{msg.content}</div>
                          <button className="submit-btn" style={{ marginTop: '16px', width: '100%' }}
                            onClick={() => msg.generationPrompt && generateFromScope(msg.generationPrompt)}>
                            Generate Contract →
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          {msg.buttons && (
                            <div className="scope-buttons">
                              {msg.buttons.map((btn, bi) => (
                                <button key={bi}
                                  className={`scope-btn ${btn.selected ? 'selected' : ''}`}
                                  onClick={() => handleScopeButton(btn, idx, msg.multiSelect)}>
                                  {btn.label}
                                </button>
                              ))}
                              {msg.multiSelect && (
                                <button className="scope-btn confirm"
                                  onClick={() => confirmMultiSelect(idx)}>
                                  Confirm ✓
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {isScopeLoading && (
                  <div className="scope-msg assistant">
                    <div className="scope-avatar">⬠</div>
                    <div className="scope-bubble">
                      <span className="scope-typing">Thinking<span className="scope-dots">...</span></span>
                    </div>
                  </div>
                )}
                <div ref={scopeEndRef} />
              </div>
              <div style={{ height: '120px' }} />
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ─── CREATE SESSION ─── */}
          {/* ═══════════════════════════════════════ */}
          {isActive && !isAuditView && !isScopingView && !isTokenPreview && (
            <div className="session">
              <div className="user-prompt-card">
                <div className="user-prompt-label">CREATE</div>
                {currentPrompt}
              </div>

              {code && (
                <div className="code-container">
                  <div className="code-header">
                    <input
                      type="text"
                      className="code-filename"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      spellCheck={false}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isStreaming && (
                        <span className="code-status">
                          <span className="code-status-dot" />
                          Generating...
                        </span>
                      )}
                      {!isStreaming && (
                        <>
                          <button className="code-action-btn" title="Copy code"
                            onClick={() => { navigator.clipboard.writeText(code); }}>
                            ⎘
                          </button>
                          <button className="code-action-btn" title="Download file"
                            onClick={() => {
                              const blob = new Blob([code], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = fileName; a.click();
                              URL.revokeObjectURL(url);
                            }}>
                            ↓
                          </button>
                          <button className="code-action-btn" title="Audit this contract"
                            style={{ color: '#6366f1', fontWeight: 600, fontSize: '12px', width: 'auto', padding: '0 10px' }}
                            onClick={() => startAudit()}>
                            Audit →
                          </button>
                          {chain.type === 'evm' && (
                            <button className="code-action-btn" title="Deploy contract"
                              style={{ color: '#22c55e', fontWeight: 600, fontSize: '12px', width: 'auto', padding: '0 10px' }}
                              onClick={() => setShowDeployPanel(!showDeployPanel)}>
                              {showDeployPanel ? 'Close Deploy' : '🚀 Deploy'}
                            </button>
                          )}
                          {chain.type === 'solana' && (
                            <button className="code-action-btn" title="Deploy to Solana"
                              style={{ color: '#9454ff', fontWeight: 600, fontSize: '12px', width: 'auto', padding: '0 10px' }}
                              onClick={() => setShowDeployPanel(!showDeployPanel)}>
                              {showDeployPanel ? 'Close Deploy' : '◐ Deploy'}
                            </button>
                          )}
                          <button className="code-action-btn" title="Deployment history"
                            style={{ color: '#64748b', fontWeight: 500, fontSize: '12px', width: 'auto', padding: '0 8px' }}
                            onClick={() => { setShowDeployHistory(!showDeployHistory); setShowDeployPanel(false); }}>
                            {showDeployHistory ? 'Close History' : '📋'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="code-body" ref={codeBodyRef}>
                    {codeLines.map((line, i) => (
                      <div
                        key={i}
                        className="code-line"
                        onMouseEnter={() => !isStreaming && handleLineHover(i + 1)}
                        onMouseLeave={() => { setHoveredLine(null); setTooltip(null); }}
                        style={{ position: 'relative' }}
                      >
                        <span className="line-number">{i + 1}</span>
                        <span className="line-content" dangerouslySetInnerHTML={{ __html: highlightSolidity(line) || '&nbsp;' }} />
                        {tooltip && tooltip.line === i + 1 && hoveredLine === i + 1 && (
                          <div className="code-tooltip">
                            <div className="code-tooltip-title">{tooltip.title}</div>
                            <div>{tooltip.explanation}</div>
                          </div>
                        )}
                      </div>
                    ))}
                    {isStreaming && <span className="cursor-blink" />}
                  </div>
                </div>
              )}

              {/* Deploy Panel */}
              {showDeployPanel && chain.type === 'evm' && code && (
                <Suspense fallback={<div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>Loading deploy panel...</div>}>
                  <EVMDeployPanel code={code} onClose={() => setShowDeployPanel(false)} />
                </Suspense>
              )}
              {showDeployPanel && chain.type === 'solana' && code && solanaType === 'token' && (
                <Suspense fallback={<div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>Loading deploy panel...</div>}>
                  <SolanaDeployPanel code={code} onClose={() => setShowDeployPanel(false)} />
                </Suspense>
              )}
              {showDeployPanel && chain.type === 'solana' && code && solanaType === 'program' && (
                <Suspense fallback={<div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>Loading guide...</div>}>
                  <SolanaPlaygroundGuide code={code} onClose={() => setShowDeployPanel(false)} />
                </Suspense>
              )}

              {/* Deploy History Panel */}
              {showDeployHistory && (
                <Suspense fallback={<div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>Loading history...</div>}>
                  <DeployHistoryPanel onClose={() => setShowDeployHistory(false)} />
                </Suspense>
              )}

              {qaAnswer && (
                <div className="user-prompt-card" style={{ borderLeft: '3px solid #6366f1' }}>
                  <div className="user-prompt-label">ANSWER</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6' }}>{qaAnswer}</div>
                </div>
              )}

              <div style={{ height: '120px' }} />
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ─── TOKEN PREVIEW PAGE ─── */}
          {/* ═══════════════════════════════════════ */}
          {isTokenPreview && (
            <div className="audit-page" style={{ maxWidth: 760, margin: '0 auto' }}>
              {/* Header */}
              <div className="audit-page-header" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {tokenInfo?.imageUrl && (
                    <img
                      src={tokenInfo.imageUrl}
                      alt={tokenInfo.name}
                      style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.25)', objectFit: 'cover', flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <div className="audit-label" style={{ letterSpacing: '0.1em' }}>TOKEN INTELLIGENCE</div>
                    <div className="audit-page-title" style={{ fontSize: 22 }}>
                      {tokenInfo?.name ?? fileName}{tokenInfo?.symbol ? ` (${tokenInfo.symbol})` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {chain.icon} {chain.name} · {addressInput.slice(0, 8)}...{addressInput.slice(-6)}
                      <button
                        onClick={() => { navigator.clipboard.writeText(addressInput); setCaCopied(true); setTimeout(() => setCaCopied(false), 1500); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontSize: 12, color: caCopied ? '#86efac' : '#64748b', transition: 'color 0.2s', lineHeight: 1 }}
                        title="Copy address"
                      >{caCopied ? '✓' : '📋'}</button>
                      {tokenInfo?.launchpad && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{tokenInfo.launchpad}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rugged banner */}
              {tokenInfo?.rugged && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🔴</span>
                  <div>
                    <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 14 }}>RUG CONFIRMED</div>
                    <div style={{ color: '#fca5a5', fontSize: 13, opacity: 0.8 }}>This token has been flagged as rugged by Rugcheck. Proceed with extreme caution.</div>
                  </div>
                </div>
              )}

              {/* Honeypot banner */}
              {tokenInfo?.isHoneypot && (
                <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>🍯</span>
                  <div>
                    <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 14 }}>HONEYPOT DETECTED</div>
                    <div style={{ color: '#fca5a5', fontSize: 13, opacity: 0.8 }}>Tokens CANNOT be sold. GoPlus Security flagged this as a honeypot.</div>
                  </div>
                </div>
              )}

              {/* Risk flags grid */}
              {(tokenInfo?.isHoneypot != null || tokenInfo?.isMintable != null || tokenInfo?.rugScore != null || tokenInfo?.insidersDetected != null) && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Security Flags</div>
                    {(tokenInfo?.website || tokenInfo?.twitter || tokenInfo?.telegram) && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {tokenInfo.website && <a href={tokenInfo.website} target="_blank" rel="noopener noreferrer" title="Website" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}>🌐</a>}
                        {tokenInfo.twitter && <a href={tokenInfo.twitter.startsWith('http') ? tokenInfo.twitter : `https://twitter.com/${tokenInfo.twitter}`} target="_blank" rel="noopener noreferrer" title="Twitter" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}>𝕏</a>}
                        {tokenInfo.telegram && <a href={tokenInfo.telegram.startsWith('http') ? tokenInfo.telegram : `https://t.me/${tokenInfo.telegram}`} target="_blank" rel="noopener noreferrer" title="Telegram" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}><svg viewBox="0 0 24 24" width="14" height="14" fill="#94a3b8" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/></svg></a>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {/* Rugcheck score */}
                    {tokenInfo?.rugScore != null && (
                      <div style={{ background: tokenInfo.rugScore > 500 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${tokenInfo.rugScore > 500 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: tokenInfo.rugScore > 500 ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                        Rugcheck: {tokenInfo.rugScore}/1000
                      </div>
                    )}
                    {/* Honeypot */}
                    {tokenInfo?.isHoneypot != null && (
                      <div style={{ background: tokenInfo.isHoneypot ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${tokenInfo.isHoneypot ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: tokenInfo.isHoneypot ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                        {tokenInfo.isHoneypot ? '🔴 Honeypot' : '✅ Not Honeypot'}
                      </div>
                    )}
                    {/* Buy tax */}
                    {tokenInfo?.buyTax != null && (
                      <div style={{ background: tokenInfo.buyTax > 10 ? 'rgba(251,146,60,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${tokenInfo.buyTax > 10 ? 'rgba(251,146,60,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: tokenInfo.buyTax > 10 ? '#fdba74' : '#86efac', fontWeight: 600 }}>
                        Buy Tax: {tokenInfo.buyTax.toFixed(1)}%
                      </div>
                    )}
                    {/* Sell tax */}
                    {tokenInfo?.sellTax != null && (
                      <div style={{ background: tokenInfo.sellTax > 10 ? 'rgba(251,146,60,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${tokenInfo.sellTax > 10 ? 'rgba(251,146,60,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: tokenInfo.sellTax > 10 ? '#fdba74' : '#86efac', fontWeight: 600 }}>
                        Sell Tax: {tokenInfo.sellTax.toFixed(1)}%
                      </div>
                    )}
                    {/* Mintable */}
                    {tokenInfo?.isMintable != null && (
                      <div style={{ background: tokenInfo.isMintable ? 'rgba(251,146,60,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${tokenInfo.isMintable ? 'rgba(251,146,60,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: tokenInfo.isMintable ? '#fdba74' : '#86efac', fontWeight: 600 }}>
                        {tokenInfo.isMintable ? '⚠️ Mintable' : '✅ Fixed Supply'}
                      </div>
                    )}
                    {/* Pausable */}
                    {tokenInfo?.isPausable && (
                      <div style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#fdba74', fontWeight: 600 }}>
                        ⚠️ Transfer Pausable
                      </div>
                    )}
                    {/* Hidden owner */}
                    {tokenInfo?.hiddenOwner && (
                      <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
                        🔴 Hidden Owner
                      </div>
                    )}
                    {/* Insiders */}
                    {tokenInfo?.insidersDetected != null && tokenInfo.insidersDetected > 0 && (
                      <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
                        🔴 {tokenInfo.insidersDetected} Insider Wallets
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Standalone socials fallback — only renders when security flags section is hidden */}
              {!(tokenInfo?.isHoneypot != null || tokenInfo?.isMintable != null || tokenInfo?.rugScore != null || tokenInfo?.insidersDetected != null) && (tokenInfo?.website || tokenInfo?.twitter || tokenInfo?.telegram) && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
                  {tokenInfo.website && <a href={tokenInfo.website} target="_blank" rel="noopener noreferrer" title="Website" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}>🌐</a>}
                  {tokenInfo.twitter && <a href={tokenInfo.twitter.startsWith('http') ? tokenInfo.twitter : `https://twitter.com/${tokenInfo.twitter}`} target="_blank" rel="noopener noreferrer" title="Twitter" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}>𝕏</a>}
                  {tokenInfo.telegram && <a href={tokenInfo.telegram.startsWith('http') ? tokenInfo.telegram : `https://t.me/${tokenInfo.telegram}`} target="_blank" rel="noopener noreferrer" title="Telegram" style={{ fontSize: 14, textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.15s', lineHeight: 1 }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}><svg viewBox="0 0 24 24" width="14" height="14" fill="#94a3b8" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/></svg></a>}
                </div>
              )}

              {/* ─── Stats grid: fixed 3×3, always 9 cards ─── */}
              {(() => {
                const fmtDollar = (v: number | undefined | null) => {
                  if (v == null || v === 0) return 'N/A';
                  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
                  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
                  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
                  return '$' + v.toFixed(0);
                };
                const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' };
                const labelStyle = { fontSize: 11, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 4 };
                const valStyle = { fontSize: 17, fontWeight: 700 as const, color: 'var(--text-primary)' };
                const naStyle = { fontSize: 17, fontWeight: 700 as const, color: '#475569' };
                const linkStyle: React.CSSProperties = { color: 'inherit', textDecoration: 'none', cursor: 'pointer' };

                const dexLink = tokenInfo?.dexUrl;
                const poolLink = tokenInfo?.url;
                const holderLink = tokenInfo?.holderUrl;

                const MaybeLink = ({ href, children }: { href?: string | null; children: React.ReactNode }) => {
                  if (!href) return <>{children}</>;
                  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; (e.currentTarget as HTMLElement).style.textDecorationStyle = 'dotted'; (e.currentTarget as HTMLElement).style.textUnderlineOffset = '3px'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}>{children}</a>;
                };

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                    {/* 1: Price */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Price</div>
                      <MaybeLink href={dexLink}>
                        {tokenInfo?.priceUsd && Number(tokenInfo.priceUsd) > 0
                          ? <div style={{ ...valStyle, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>${Number(tokenInfo.priceUsd) < 0.01 ? Number(tokenInfo.priceUsd).toExponential(2) : Number(tokenInfo.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                          : <div style={naStyle}>N/A</div>}
                      </MaybeLink>
                      {tokenInfo?.priceChange24h != null && (
                        <div style={{ fontSize: 12, color: tokenInfo.priceChange24h >= 0 ? '#86efac' : '#fca5a5', marginTop: 3, fontWeight: 600 }}>
                          {tokenInfo.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(tokenInfo.priceChange24h).toFixed(2)}% 24h
                        </div>
                      )}
                    </div>
                    {/* 2: Market Cap */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Market Cap</div>
                      <MaybeLink href={dexLink}>
                        <div style={tokenInfo?.marketCap ? valStyle : naStyle}>{fmtDollar(tokenInfo?.marketCap)}</div>
                      </MaybeLink>
                    </div>
                    {/* 3: ATH */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>{tokenInfo?.athLabel || 'ATH'} Market Cap</div>
                      {tokenInfo?.athMarketCap != null ? (
                        <>
                          <div style={valStyle}>{fmtDollar(tokenInfo.athMarketCap)}</div>
                          {tokenInfo.athMultiplier != null && tokenInfo.athMultiplier > 1 && (
                            <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 3, fontWeight: 600 }}>
                              ▼ {((1 - 1 / tokenInfo.athMultiplier) * 100).toFixed(1)}% from ATH (↓{tokenInfo.athMultiplier.toFixed(1)}x)
                            </div>
                          )}
                          {tokenInfo.athMultiplier != null && tokenInfo.athMultiplier <= 1.2 && tokenInfo.athMultiplier >= 0.8 && (
                            <div style={{ fontSize: 12, color: '#fdba74', marginTop: 3, fontWeight: 600 }}>Near ATH</div>
                          )}
                        </>
                      ) : (
                        <div style={naStyle}>N/A</div>
                      )}
                    </div>
                    {/* 4: Liquidity */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Liquidity</div>
                      <MaybeLink href={poolLink}>
                        <div style={tokenInfo?.liquidity ? valStyle : naStyle}>{fmtDollar(tokenInfo?.liquidity)}</div>
                      </MaybeLink>
                    </div>
                    {/* 5: Volume 24h */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Volume 24h</div>
                      <MaybeLink href={dexLink}>
                        <div style={tokenInfo?.volume24h ? valStyle : naStyle}>{fmtDollar(tokenInfo?.volume24h)}</div>
                      </MaybeLink>
                    </div>
                    {/* 6: Txns 24h */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Txns 24h</div>
                      <MaybeLink href={dexLink}>
                        <div style={tokenInfo?.txns24h ? valStyle : naStyle}>{tokenInfo?.txns24h ? tokenInfo.txns24h.toLocaleString() : 'N/A'}</div>
                      </MaybeLink>
                      {tokenInfo?.buys24h != null && tokenInfo?.sells24h != null && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{tokenInfo.buys24h}B / {tokenInfo.sells24h}S</div>
                      )}
                    </div>
                    {/* 7: Holders */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Holders</div>
                      <MaybeLink href={holderLink}>
                        <div style={tokenInfo?.totalHolders ? valStyle : naStyle}>{tokenInfo?.totalHolders ? tokenInfo.totalHolders.toLocaleString() : 'N/A'}</div>
                      </MaybeLink>
                    </div>
                    {/* 8: LP Locked */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>LP Locked</div>
                      {tokenInfo?.lpLockedPct != null ? (
                        <div style={{ ...valStyle, color: tokenInfo.lpLockedPct >= 90 ? '#86efac' : tokenInfo.lpLockedPct >= 50 ? '#fdba74' : '#fca5a5' }}>
                          {tokenInfo.lpLockedPct.toFixed(1)}%
                        </div>
                      ) : (
                        <div style={naStyle}>N/A</div>
                      )}
                    </div>
                    {/* 9: Pools */}
                    <div style={cardStyle}>
                      <div style={labelStyle}>Pools</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={tokenInfo?.pairCount ? valStyle : naStyle}>{tokenInfo?.pairCount ?? 'N/A'}</span>
                        {tokenInfo?.url && (
                          <a href={tokenInfo.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', borderBottom: '1px dashed rgba(99,102,241,0.4)', lineHeight: 1.2 }}>DexScreener ↗</a>
                        )}
                      </div>
                      {tokenInfo?.dexName && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{tokenInfo.dexName}</div>}
                    </div>
                  </div>
                );
              })()}



              {/* ─── Collapsible Code Panel ─── */}
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setCodeExpanded(!codeExpanded)}
                  style={{
                    width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: codeExpanded ? '10px 10px 0 0' : 10, padding: '12px 18px',
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                    transition: 'border-radius 0.2s',
                  }}
                >
                  <span>{codeExpanded ? '▼' : '▶'} Code</span>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{code ? `${code.split('\n').length} lines` : ''}</span>
                </button>
                {codeExpanded && (
                  <div style={{
                    border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px',
                    background: '#0a0a12', overflow: 'hidden',
                  }}>
                    <pre style={{
                      maxHeight: 400, overflowY: 'auto', padding: 18, margin: 0,
                      fontSize: 12, lineHeight: 1.6, fontFamily: 'var(--font-mono)',
                      color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                      <code>{code || 'No source code available.'}</code>
                    </pre>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => { navigator.clipboard.writeText(code); }}
                        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 6, padding: '5px 14px', fontSize: 12, color: '#a5b4fc', cursor: 'pointer', fontWeight: 600 }}
                      >📋 Copy</button>
                      <button
                        disabled
                        title="Coming Soon"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 14px', fontSize: 12, color: '#475569', cursor: 'not-allowed', fontWeight: 600 }}
                      >🚀 Deploy</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Audit CTA */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                  Intelligence gathered. Ready to run deep security analysis across all {agents.length} specialized agents.
                </div>
                <button
                  className="submit-btn"
                  style={{ fontSize: 16, padding: '14px 40px', borderRadius: 10, fontWeight: 700, letterSpacing: '0.03em', width: '100%', maxWidth: 380 }}
                  onClick={() => startAudit(code)}
                >
                  Run Security Audit →
                </button>
                <div style={{ fontSize: 12, color: '#475569' }}>1 credit · {agents.length} agents · full report</div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ─── AUDIT PAGE ─── */}
          {/* ═══════════════════════════════════════ */}
          {isAuditView && (
            <div className="audit-page">
              {/* Audit header bar */}
              <div className="audit-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {tokenInfo?.found && tokenInfo?.imageUrl && (
                    <img
                      src={tokenInfo.imageUrl}
                      alt={tokenInfo.name}
                      style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: '#0f0f15', flexShrink: 0,
                        border: '2px solid rgba(99,102,241,0.2)',
                        objectFit: 'cover',
                      }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <div className="audit-label">SECURITY AUDIT</div>
                    <div className="audit-page-title">
                      {tokenInfo?.found ? `${tokenInfo.name} (${tokenInfo.symbol})` : fileName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                      {chain.icon} {chain.name} {addressInput && `· ${addressInput.slice(0, 6)}...${addressInput.slice(-4)}`}
                    </div>
                  </div>
                  {tokenInfo?.found && (
                    <div className="token-info-card">
                      <div className="token-info-row">
                        <div className="token-info-item">
                          <span className="token-info-label">Price</span>
                          <span className="token-info-value">
                            ${Number(tokenInfo.priceUsd || 0) < 0.01
                              ? Number(tokenInfo.priceUsd || 0).toExponential(2)
                              : Number(tokenInfo.priceUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">24h</span>
                          <span className={`token-info-value ${(tokenInfo.priceChange24h || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {(tokenInfo.priceChange24h || 0) >= 0 ? '+' : ''}{tokenInfo.priceChange24h?.toFixed(2)}%
                          </span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">Volume</span>
                          <span className="token-info-value">${(tokenInfo.volume24h || 0) >= 1e6
                            ? (tokenInfo.volume24h! / 1e6).toFixed(1) + 'M'
                            : (tokenInfo.volume24h || 0) >= 1e3
                              ? (tokenInfo.volume24h! / 1e3).toFixed(1) + 'K'
                              : tokenInfo.volume24h?.toFixed(0)}</span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">Txns</span>
                          <span className="token-info-value">
                            {(tokenInfo.txns24h || 0).toLocaleString()}
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>
                              ({tokenInfo.buys24h}B / {tokenInfo.sells24h}S)
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="token-info-row">
                        <div className="token-info-item">
                          <span className="token-info-label">Liquidity</span>
                          <span className="token-info-value">${(tokenInfo.liquidity || 0) >= 1e6
                            ? (tokenInfo.liquidity! / 1e6).toFixed(1) + 'M'
                            : (tokenInfo.liquidity || 0) >= 1e3
                              ? (tokenInfo.liquidity! / 1e3).toFixed(1) + 'K'
                              : tokenInfo.liquidity?.toFixed(0)}</span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">MCap</span>
                          <span className="token-info-value">{tokenInfo.marketCap
                            ? '$' + (tokenInfo.marketCap >= 1e9
                              ? (tokenInfo.marketCap / 1e9).toFixed(2) + 'B'
                              : tokenInfo.marketCap >= 1e6
                                ? (tokenInfo.marketCap / 1e6).toFixed(1) + 'M'
                                : (tokenInfo.marketCap / 1e3).toFixed(1) + 'K')
                            : '—'}</span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">DEX</span>
                          <span className="token-info-value">{tokenInfo.dexName}</span>
                        </div>
                        <div className="token-info-item">
                          <span className="token-info-label">Pairs</span>
                          <span className="token-info-value">{tokenInfo.pairCount}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {report && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="code-action-btn" style={{ width: 'auto', padding: '6px 14px', fontSize: '13px', fontWeight: 500 }}
                      onClick={() => setShowReport(!showReport)}>
                      {showReport ? 'Pipeline' : 'Report'}
                    </button>
                    <button className="submit-btn" onClick={handleDownloadReport} disabled={isGeneratingPdf}>
                      {isGeneratingPdf ? 'Generating PDF...' : 'Download Report ↓'}
                    </button>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '24px' }}>
                <span>{auditProgress}/{DEFAULT_AGENTS.length} agents</span>
                <span>{progressPercent}%</span>
              </div>

              {/* ─── Error Banner ─── */}
              {auditError && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#fca5a5',
                }}>
                  <span style={{ fontSize: '16px' }}>⚠</span>
                  <span><strong>Audit failed:</strong> {auditError}</span>
                </div>
              )}


              {/* ─── Report View ─── */}
              {showReport && report && (
                <div className="audit-document" ref={reportRef}>
                  {/* ─── Document Header ─── */}
                  <div className="doc-header">
                    <div className="doc-header-rule" />
                    <h1 className="doc-title">Security Audit Report</h1>
                    <table className="doc-meta-table">
                      <tbody>
                        <tr><td className="doc-meta-key">Contract</td><td>{report.contractName}</td></tr>
                        <tr><td className="doc-meta-key">Chain</td><td>{report.chain}</td></tr>
                        <tr><td className="doc-meta-key">Date</td><td>{new Date(report.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                        <tr><td className="doc-meta-key">Security Score</td><td>{report.riskScore} / 100 — {report.riskScore >= 80 ? 'Low Risk' : report.riskScore >= 50 ? 'Medium Risk' : 'High Risk'}</td></tr>
                        <tr><td className="doc-meta-key">Rules Applied</td><td>{report.rulesApplied}</td></tr>
                        <tr><td className="doc-meta-key">Findings</td><td>
                          {report.findings.filter(f => f.severity === 'critical').length} Critical · {report.findings.filter(f => f.severity === 'high').length} High · {report.findings.filter(f => f.severity === 'medium').length} Medium · {report.findings.filter(f => f.severity === 'low').length} Low
                        </td></tr>
                      </tbody>
                    </table>
                    <div className="doc-header-rule" />
                  </div>

                  {/* ─── 1.0 Executive Summary ─── */}
                  <section className="doc-section">
                    <h2 className="doc-section-num">1.0 — Executive Summary</h2>

                    {report.tokenOverview && (
                      <>
                        <h3 className="doc-subsection-title" style={{ marginBottom: '4px' }}>Contract Overview</h3>
                        <p className="doc-body">{report.tokenOverview}</p>
                      </>
                    )}

                    <h3 className="doc-subsection-title" style={{ marginTop: report.tokenOverview ? '16px' : '0', marginBottom: '4px' }}>Audit Summary</h3>
                    <p className="doc-body">{report.summary}</p>
                  </section>

                  {/* ─── 2.0 Methodology ─── */}
                  {report.methodology && (
                    <section className="doc-section">
                      <h2 className="doc-section-num">2.0 — Methodology</h2>
                      <p className="doc-body">{report.methodology}</p>
                      <p className="doc-body" style={{ marginTop: '8px' }}>
                        The following specialized agents were deployed against the contract:
                      </p>
                      <table className="doc-agent-table">
                        <thead>
                          <tr><th>Agent</th><th>Specialty</th><th>Result</th></tr>
                        </thead>
                        <tbody>
                          {report.agentResults.map((ar) => (
                            <tr key={ar.agentId}>
                              <td>{ar.agentName}</td>
                              <td>{DEFAULT_AGENTS.find(a => a.id === ar.agentId)?.description || '—'}</td>
                              <td>{ar.findingCount > 0 ? `${ar.findingCount} finding${ar.findingCount > 1 ? 's' : ''}` : 'Clear'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  {/* ─── 3.0 Code Review ─── */}
                  {report.codeSegments && report.codeSegments.length > 0 && (
                    <section className="doc-section">
                      <h2 className="doc-section-num">3.0 — Code Review</h2>
                      <p className="doc-body">
                        The contract was decomposed into {report.codeSegments.length} logical segments for line-by-line analysis. Each segment is presented below with its source code, a technical assessment, and any associated findings.
                      </p>

                      {report.codeSegments.map((seg, i) => {
                        const segFindings = report.findings.filter(f =>
                          f.line && f.line >= seg.startLine && f.line <= seg.endLine
                        );
                        return (
                          <div key={i} className="doc-code-block">
                            <h3 className="doc-subsection-num">
                              3.{i + 1} — {seg.title}
                              <span className="doc-line-ref">Lines {seg.startLine}–{seg.endLine}</span>
                              <span className={`doc-risk-tag ${seg.risk}`}>{seg.risk}</span>
                            </h3>

                            <pre className="doc-code"><code>{seg.code}</code></pre>

                            <div className="doc-analysis">
                              <div className="doc-analysis-label">Analysis</div>
                              <p>{seg.summary}</p>
                            </div>

                            {segFindings.length > 0 && (
                              <div className="doc-seg-findings">
                                {segFindings.map((f, fi) => (
                                  <div key={fi} className="doc-seg-finding">
                                    <span className={`doc-sev ${f.severity}`}>{f.severity}</span>
                                    <strong>{f.title}</strong>
                                    {f.line && <span className="doc-finding-line">Line {f.line}</span>}
                                    <span className="doc-sep">—</span>
                                    <span>{f.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {/* ─── 4.0 Detailed Findings ─── */}
                  <section className="doc-section">
                    <h2 className="doc-section-num">{report.codeSegments?.length ? '4.0' : '3.0'} — Findings</h2>
                    {report.findings.length === 0 ? (
                      <p className="doc-body">No vulnerabilities were identified during the audit. All 8 agents completed their scans without detecting issues within their respective domains.</p>
                    ) : (
                      <>
                        <p className="doc-body">
                          A total of {report.findings.length} finding{report.findings.length > 1 ? 's were' : ' was'} identified across {report.agentResults.filter(a => a.findingCount > 0).length} agent{report.agentResults.filter(a => a.findingCount > 0).length > 1 ? 's' : ''}.
                        </p>
                        {report.findings.map((f, i) => {
                          // Extract code snippet around the finding's line
                          const codeLines = code.split('\n');
                          const snippetRadius = 7;
                          const fLine = f.line || 0;
                          const snippetStart = Math.max(0, fLine - snippetRadius - 1);
                          const snippetEnd = Math.min(codeLines.length, fLine + snippetRadius);
                          const snippet = fLine > 0 ? codeLines.slice(snippetStart, snippetEnd) : [];

                          return (
                          <div key={i} className="doc-finding">
                            <h3 className="doc-finding-header">
                              <span className={`doc-sev ${f.severity}`}>{f.severity}</span>
                              <span className="doc-finding-title">{f.title}</span>
                              {f.line && <span className="doc-finding-line">Line {f.line}</span>}
                            </h3>
                            <div className="doc-finding-meta">
                              Identified by: {DEFAULT_AGENTS.find(a => a.id === f.agent)?.name || f.agent}
                            </div>
                            <p className="doc-body">{f.description}</p>

                            {/* Code snippet */}
                            {snippet.length > 0 && (
                              <div className="doc-finding-code-wrap">
                                <div className="doc-finding-code-label">
                                  Referenced Code — Lines {snippetStart + 1}–{snippetEnd}
                                </div>
                                <pre className="doc-finding-code">{snippet.map((line, li) => {
                                  const lineNum = snippetStart + li + 1;
                                  const isTarget = lineNum === fLine;
                                  return (
                                    <div key={li} className={`doc-code-line ${isTarget ? 'highlighted' : ''}`}>
                                      <span className="doc-code-linenum">{lineNum}</span>
                                      <span className="doc-code-text">{line}</span>
                                    </div>
                                  );
                                })}</pre>
                              </div>
                            )}

                            {/* Proof-of-Concept Exploit */}
                            {f.exploit && (
                              <div className="doc-exploit-wrap">
                                <div className="doc-exploit-label">⚔ Proof-of-Concept Exploit</div>
                                <pre className="doc-exploit-code"><code>{f.exploit}</code></pre>
                              </div>
                            )}

                            {/* Reproduction Steps */}
                            {f.reproductionSteps && f.reproductionSteps.length > 0 && (
                              <div className="doc-repro-wrap">
                                <div className="doc-repro-label">Attack Reproduction Steps</div>
                                <ol className="doc-repro-list">
                                  {f.reproductionSteps.map((step, si) => (
                                    <li key={si}>{step.replace(/^\d+\.\s*/, '')}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {f.recommendation && (
                              <div className="doc-recommendation">
                                <strong>Recommendation:</strong> {f.recommendation}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </>
                    )}
                  </section>

                  {/* ─── 5.0 Conclusion ─── */}
                  <section className="doc-section">
                    <h2 className="doc-section-num">{report.codeSegments?.length ? '5.0' : '4.0'} — Conclusion & Recommendation</h2>
                    <p className="doc-body">{report.recommendation}</p>
                  </section>

                  {/* ─── Footer ─── */}
                  <div className="doc-footer">
                    <div className="doc-header-rule" />
                    <p>Generated by <strong>Pentagonal</strong> — Smart Contract Forge</p>
                    <p>{new Date(report.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* ─── Report Synthesis Spinner ─── */}
              {generatingReport && !report && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '72px 0', gap: '14px',
                }}>
                  <div style={{
                    width: '28px', height: '28px',
                    border: '2px solid rgba(99,102,241,0.15)',
                    borderTop: '2px solid #6366f1',
                    borderRadius: '50%',
                    animation: 'spin 0.75s linear infinite',
                    flexShrink: 0,
                  }} />
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, letterSpacing: '0.02em' }}>
                    Generating report…
                  </p>
                </div>
              )}

              {/* ─── Pipeline View ─── */}
              {!showReport && (
                <>
                  {/* Agent Pipeline */}
                  <div className="agent-pipeline">
                    {agents.map((agent, idx) => (
                      <div key={agent.id} className={`pipeline-step ${agent.status}`}>
                        <div className="pipeline-indicator">
                          <div className={`pipeline-dot ${agent.status}`}>
                            {agent.status === 'clear' && '✓'}
                            {agent.status === 'finding' && '⚠'}
                            {agent.status === 'critical' && '!'}
                            {agent.status === 'scanning' && ''}
                            {agent.status === 'queued' && (idx + 1)}
                          </div>
                          {idx < agents.length - 1 && (
                            <div className={`pipeline-line ${
                              agent.status === 'clear' || agent.status === 'finding' || agent.status === 'critical' ? 'done' : ''
                            }`} />
                          )}
                        </div>
                        <div className="pipeline-content">
                          <div className="pipeline-name">{agent.name}</div>
                          <div className="pipeline-desc">{agent.description}</div>
                          <div className="pipeline-status-text">
                            {agent.status === 'queued' && 'Queued'}
                            {agent.status === 'scanning' && (
                              <span style={{ color: '#6366f1' }}>
                                <span className="code-status-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginRight: '6px' }} />
                                Scanning...
                              </span>
                            )}
                            {agent.status === 'clear' && <span style={{ color: '#10b981' }}>✓ Clear</span>}
                            {agent.status === 'finding' && (
                              <span style={{ color: '#f59e0b' }}>⚠ {agent.findingCount} finding{agent.findingCount > 1 ? 's' : ''}</span>
                            )}
                            {agent.status === 'critical' && (
                              <span style={{ color: '#ef4444' }}>⛔ {agent.findingCount} finding{agent.findingCount > 1 ? 's' : ''}</span>
                            )}
                          </div>

                          {/* Technique list — visible when scanning or completed */}
                          {(agent.status === 'scanning' || agent.status === 'clear' || agent.status === 'finding' || agent.status === 'critical') && (
                            <div className={`pipeline-techniques ${agent.status === 'scanning' ? 'active' : ''}`}>
                              {agent.techniques.map((t, ti) => (
                                <div key={ti} className={`pipeline-technique ${
                                  agent.status === 'scanning' ? 'scanning' : 
                                  agent.status === 'clear' ? 'clear' : 'flagged'
                                }`}>
                                  <span className="technique-bullet">→</span>
                                  {t}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Findings */}
                  {findings.length > 0 && (
                    <div className="findings-section" style={{ marginTop: '32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div className="findings-label">
                          {findings.filter(f => !f.fixed).length} Finding{findings.filter(f => !f.fixed).length !== 1 ? 's' : ''}
                        </div>
                        {findings.filter(f => !f.fixed).length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {findings.some(f => !f.fixed && f.severity === 'critical') && (
                              <button className="batch-fix-btn critical" onClick={() => handleFixBySeverity('critical')} disabled={fixingIds.size > 0}>
                                Fix Critical
                              </button>
                            )}
                            {findings.some(f => !f.fixed && f.severity === 'high') && (
                              <button className="batch-fix-btn high" onClick={() => handleFixBySeverity('high')} disabled={fixingIds.size > 0}>
                                Fix High
                              </button>
                            )}
                            {findings.some(f => !f.fixed && f.severity === 'medium') && (
                              <button className="batch-fix-btn medium" onClick={() => handleFixBySeverity('medium')} disabled={fixingIds.size > 0}>
                                Fix Med
                              </button>
                            )}
                            {findings.some(f => !f.fixed && f.severity === 'low') && (
                              <button className="batch-fix-btn low" onClick={() => handleFixBySeverity('low')} disabled={fixingIds.size > 0}>
                                Fix Low
                              </button>
                            )}
                            <button className="batch-fix-btn all" onClick={handleFixAll} disabled={fixingIds.size > 0}>
                              Fix All
                            </button>
                          </div>
                        )}
                      </div>
                      {findings.map((finding) => (
                        <div key={finding.id} className={`finding-card ${finding.severity === 'critical' ? 'critical' : ''}`}
                          style={finding.fixed ? { opacity: 0.5 } : {}}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span className={`finding-severity ${finding.severity}`}>{finding.severity}</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {DEFAULT_AGENTS.find(a => a.id === finding.agent)?.name || finding.agent}
                            </span>
                          </div>
                          <div className="finding-title">
                            {finding.fixed ? '✓ ' : ''}{finding.title}
                          </div>
                          <div className="finding-description">{finding.description}</div>
                          {finding.recommendation && (
                            <div style={{ fontSize: '13px', color: '#6366f1', marginBottom: '12px' }}>
                              💡 {finding.recommendation}
                            </div>
                          )}
                          {!finding.fixed && (
                            <div className="finding-actions">
                              <button
                                className="finding-btn fix"
                                onClick={() => handleFix(finding)}
                                disabled={fixingIds.has(finding.id)}
                              >
                                {fixingIds.has(finding.id) ? 'Fixing...' : 'Auto-Fix'}
                              </button>
                              <button className="finding-btn ask"
                                onClick={() => setPrompt(`Tell me more about: ${finding.title}`)}>
                                Ask About This
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Re-audit button after fixes */}
                      {findings.some(f => f.fixed) && (
                        <button className="submit-btn" style={{ marginTop: '16px' }}
                          onClick={() => startAudit()}>
                          Re-Audit Fixed Contract →
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Q&A */}
              {qaAnswer && (
                <div className="user-prompt-card" style={{ borderLeft: '3px solid #6366f1', marginTop: '24px' }}>
                  <div className="user-prompt-label">ANSWER</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6' }}>{qaAnswer}</div>
                </div>
              )}

              <div style={{ height: '120px' }} />
            </div>
          )}
        </div>

        {/* ─── Bottom Prompt ─── */}
        {isActive && (
          <div className="bottom-prompt">
            <div className="prompt-container">
              <div className="prompt-box">
                <textarea
                  ref={textareaRef}
                  className="prompt-textarea"
                  placeholder={
                    isStreaming ? 'Generating...' :
                    isAuditing ? 'Auditing...' :
                    isScopeLoading ? 'Thinking...' :
                    isScopingView ? 'Type your answer...' :
                    isAuditView ? 'Ask about findings or request changes...' :
                    'Ask about this code or request changes...'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming || isAuditing || isScopeLoading}
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
                <div className="prompt-controls">
                  <div className="prompt-tabs">
                    {!isAuditView && (
                      <>
                        <button className={`prompt-tab ${mode === 'create' ? 'active' : ''}`}
                          onClick={() => setMode('create')}>
                          ⚡ Create
                        </button>
                        <button className={`prompt-tab ${mode === 'audit' ? 'active' : ''}`}
                          onClick={() => { setMode('audit'); if (code && !isStreaming) startAudit(); }}>
                          🔍 Audit
                        </button>
                      </>
                    )}
                    <div style={{ position: 'relative' }}>
                      <button className="chain-selector"
                        onClick={() => setShowChainDropdown(!showChainDropdown)}>
                        <span>{chain.icon}</span>
                        <span>{chain.name}</span>
                      </button>
                    </div>
                  </div>
                  <div className="prompt-right">
                    <button className="submit-btn"
                      onClick={handleSubmit}
                      disabled={isStreaming || isAuditing || !prompt.trim()}>
                      Send →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />
      {showPaymentModal && (
        <Suspense fallback={null}>
          <PaymentModalLazy
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={(amount: number) => {
              creditActions.addCredits(amount);
              creditActions.refetch();
            }}
            packId={paymentPackId}
            userId={user?.id || ''}
          />
        </Suspense>
      )}
      {showApiKeysModal && (
        <Suspense fallback={null}>
          <ApiKeysModalLazy onClose={() => setShowApiKeysModal(false)} />
        </Suspense>
      )}
    </>
  );
}
