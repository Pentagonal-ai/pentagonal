// ─── Chain Types ───
export type ChainType = 'evm' | 'solana';

export interface Chain {
  id: string;
  name: string;
  type: ChainType;
  icon: string;
  explorerApi?: string;
  explorerUrl?: string;
}

export const CHAINS: Chain[] = [
  { id: 'ethereum', name: 'Ethereum', type: 'evm', icon: 'Ξ', explorerApi: 'https://api.etherscan.io/api', explorerUrl: 'https://etherscan.io' },
  { id: 'polygon', name: 'Polygon', type: 'evm', icon: '⬡', explorerApi: 'https://api.polygonscan.com/api', explorerUrl: 'https://polygonscan.com' },
  { id: 'arbitrum', name: 'Arbitrum', type: 'evm', icon: '◆', explorerApi: 'https://api.arbiscan.io/api', explorerUrl: 'https://arbiscan.io' },
  { id: 'base', name: 'Base', type: 'evm', icon: '◎', explorerApi: 'https://api.basescan.org/api', explorerUrl: 'https://basescan.org' },
  { id: 'optimism', name: 'Optimism', type: 'evm', icon: '⊙', explorerApi: 'https://api-optimistic.etherscan.io/api', explorerUrl: 'https://optimistic.etherscan.io' },
  { id: 'bsc', name: 'BSC', type: 'evm', icon: '◈', explorerApi: 'https://api.bscscan.com/api', explorerUrl: 'https://bscscan.com' },
  { id: 'avalanche', name: 'Avalanche', type: 'evm', icon: '▲', explorerApi: 'https://api.snowtrace.io/api', explorerUrl: 'https://snowtrace.io' },
  { id: 'solana', name: 'Solana', type: 'solana', icon: '◐', explorerUrl: 'https://solscan.io' },
];

// ─── Mode ───
export type Mode = 'create' | 'audit';

// ─── App State ───
export type AppState = 'landing' | 'scoping' | 'streaming' | 'complete' | 'auditing' | 'audit-complete' | 'token-preview';

// ─── Code Explanation ───
export interface CodeSection {
  startLine: number;
  endLine: number;
  title: string;
  explanation: string;
}

// ─── Agent Types ───
export type AgentStatusType = 'idle' | 'queued' | 'scanning' | 'clear' | 'finding' | 'critical';

export interface Agent {
  id: string;
  name: string;
  description: string;
  techniques: string[];
  status: AgentStatusType;
  findingCount: number;
  findings: Finding[];
}

export const DEFAULT_AGENTS: Agent[] = [
  { id: 'reentrancy', name: 'Reentrancy Hunter', description: 'Checks all reentrancy vectors including cross-function and cross-contract', techniques: ['Cross-function reentrancy via external calls', 'Read-only reentrancy on view functions', 'Cross-contract callback exploitation', 'State changes after external calls'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'flash-loan', name: 'Flash Loan Attacker', description: 'Simulates flash loan exploits and price manipulation attacks', techniques: ['Flash loan price oracle manipulation', 'Liquidity pool drain via atomic arbitrage', 'Collateral inflation attacks', 'Flash mint governance takeover'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'access-control', name: 'Access Control Prober', description: 'Tests permission models and privilege escalation paths', techniques: ['Missing onlyOwner/admin modifiers', 'Unprotected initialize() re-initialization', 'Privilege escalation via delegatecall', 'tx.origin authentication bypass'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'gas-griefing', name: 'Gas Optimization', description: 'Identifies gas inefficiencies and DoS via gas griefing', techniques: ['Unbounded loop gas exhaustion', 'Storage slot packing inefficiency', 'Excessive SLOAD/SSTORE operations', 'Block gas limit DoS via array iteration'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'oracle', name: 'Oracle Manipulator', description: 'Checks oracle dependencies and manipulation vectors', techniques: ['Spot price oracle manipulation via swaps', 'Stale price feed exploitation', 'TWAP oracle window manipulation', 'Chainlink heartbeat timeout abuse'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'front-running', name: 'Front-Running Scanner', description: 'Detects MEV extraction and sandwich attack opportunities', techniques: ['Sandwich attack on swap functions', 'Transaction ordering dependency', 'Commit-reveal scheme absence', 'Slippage parameter manipulation'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'overflow', name: 'Integer Overflow Hunter', description: 'Checks arithmetic safety and integer boundary issues', techniques: ['Unchecked arithmetic in pre-0.8 code', 'Precision loss in division operations', 'Type casting truncation (uint256→uint128)', 'Underflow in balance subtraction'], status: 'queued', findingCount: 0, findings: [] },
  { id: 'economic', name: 'Economic Exploit Agent', description: 'Analyzes economic attack vectors and tokenomics flaws', techniques: ['Token supply inflation via mint abuse', 'Fee-on-transfer accounting mismatch', 'Reward distribution gaming', 'Deflationary death spiral conditions'], status: 'queued', findingCount: 0, findings: [] },
];

// ─── Findings ───
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation?: string;
  exploit?: string;
  reproductionSteps?: string[];
  agent: string;
  line?: number;
  fixed?: boolean;
}

export interface CodeSegment {
  title: string;
  startLine: number;
  endLine: number;
  code: string;
  summary: string;
  risk: string;
  findingIds: string[];
}

export interface AuditReport {
  contractName: string;
  chain: string;
  timestamp: string;
  summary: string;
  tokenOverview?: string;
  riskScore: number; // 0-100, lower = more secure
  findings: Finding[];
  codeSegments: CodeSegment[];
  agentResults: { agentId: string; agentName: string; status: string; findingCount: number }[];
  rulesApplied: number;
  recommendation: string;
  methodology: string;
}

// ─── Contract Source (from chain explorer) ───
export interface ContractSource {
  name: string;
  code: string;
  compiler: string;
  chain: string;
  address: string;
  verified: boolean;
}

// ─── Rules ───
export interface Rule {
  id: string;
  text: string;
  source: string;
  severity: Severity;
  createdAt: string;
}

// ─── Message for Q&A ───
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Scoping ───
export interface ScopeButton {
  label: string;
  value: string;
  selected?: boolean;
}

export interface ScopeMessage {
  role: 'user' | 'assistant';
  content: string;
  buttons?: ScopeButton[];
  multiSelect?: boolean;
  inputNeeded?: boolean;
  isConfirmation?: boolean;
  generationPrompt?: string;
}
