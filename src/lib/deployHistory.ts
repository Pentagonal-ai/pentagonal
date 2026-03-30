// Deployment history stored in localStorage

export interface DeploymentRecord {
  id: string;
  contractName: string;
  address: string;
  txHash: string;
  chain: string;
  chainId: number;
  chainType: 'evm' | 'solana';
  timestamp: number;
  network: 'mainnet' | 'testnet';
}

const STORAGE_KEY = 'pentagonal-deployments';

export function getDeployHistory(): DeploymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeployRecord(record: Omit<DeploymentRecord, 'id' | 'timestamp'>): void {
  const history = getDeployHistory();
  history.unshift({
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  });
  // Keep last 50 deployments
  if (history.length > 50) history.length = 50;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearDeployHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
