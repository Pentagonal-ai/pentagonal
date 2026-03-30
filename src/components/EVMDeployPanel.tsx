'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { addDeployRecord } from '@/lib/deployHistory';

interface CompileResult {
  success: boolean;
  contractName?: string;
  abi?: unknown[];
  bytecode?: string;
  constructorArgs?: Array<{ name: string; type: string; internalType?: string }>;
  gasEstimates?: { codeDeposit?: string; execution?: string; total?: string };
  errors?: Array<{ message: string; severity: string }>;
  warnings?: Array<{ message: string }>;
  availableContracts?: string[];
  solcVersion?: string;
  error?: string;
}

interface DeployResult {
  hash: string;
  address?: string;
}

// Map chain IDs for name display
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 11155111: 'Sepolia', 137: 'Polygon', 80002: 'Amoy',
  56: 'BSC', 97: 'BSC Testnet', 42161: 'Arbitrum', 421614: 'Arb Sepolia',
  8453: 'Base', 84532: 'Base Sepolia', 10: 'Optimism', 11155420: 'OP Sepolia',
  43114: 'Avalanche', 43113: 'Fuji',
};

const TESTNET_FAUCETS: Record<number, Array<{ name: string; url: string }>> = {
  11155111: [
    { name: 'Google Cloud Faucet', url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' },
    { name: 'Alchemy', url: 'https://sepoliafaucet.com/' },
  ],
  97: [{ name: 'BNB Chain Faucet', url: 'https://www.bnbchain.org/en/testnet-faucet' }],
  80002: [{ name: 'Polygon Faucet', url: 'https://faucet.polygon.technology/' }],
  421614: [{ name: 'Arbitrum Faucet', url: 'https://faucet.arbitrum.io/' }],
  84532: [{ name: 'Base Faucet', url: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet' }],
  11155420: [{ name: 'Superchain Faucet', url: 'https://app.optimism.io/faucet' }],
  43113: [{ name: 'Avax Faucet', url: 'https://core.app/tools/testnet-faucet/' }],
};

const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io', 11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com', 80002: 'https://amoy.polygonscan.com',
  56: 'https://bscscan.com', 97: 'https://testnet.bscscan.com',
  42161: 'https://arbiscan.io', 421614: 'https://sepolia.arbiscan.io',
  8453: 'https://basescan.org', 84532: 'https://sepolia.basescan.org',
  10: 'https://optimistic.etherscan.io', 11155420: 'https://sepolia-optimism.etherscan.io',
  43114: 'https://snowscan.xyz', 43113: 'https://testnet.snowscan.xyz',
};

const TESTNET_IDS = new Set([11155111, 80002, 97, 421614, 84532, 11155420, 43113]);

type DeployStep = 'idle' | 'compiling' | 'compiled' | 'deploying' | 'deployed' | 'error';

interface EVMDeployPanelProps {
  code: string;
  onClose: () => void;
}

export function EVMDeployPanel({ code, onClose }: EVMDeployPanelProps) {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();

  const [step, setStep] = useState<DeployStep>('idle');
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [selectedContract, setSelectedContract] = useState('');
  const [constructorValues, setConstructorValues] = useState<Record<string, string>>({});
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  // Fetch balance when connected
  useEffect(() => {
    if (address && publicClient) {
      publicClient.getBalance({ address }).then(bal => {
        const ethBal = Number(bal) / 1e18;
        setBalance(ethBal.toFixed(4));
      }).catch(() => setBalance(null));
    }
  }, [address, publicClient, chainId]);

  // Auto-compile on mount
  useEffect(() => {
    if (code.trim()) {
      handleCompile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompile = useCallback(async () => {
    setStep('compiling');
    setErrorMsg('');
    setCompileResult(null);

    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCode: code, contractName: selectedContract || undefined }),
      });

      const data: CompileResult = await res.json();

      if (!data.success) {
        setStep('error');
        const errMsg = data.errors?.map(e => e.message).join('\n') || data.error || 'Compilation failed';
        setErrorMsg(errMsg);
        return;
      }

      setCompileResult(data);
      setSelectedContract(data.contractName || '');
      setStep('compiled');

      // Initialize constructor arg values
      if (data.constructorArgs) {
        const defaults: Record<string, string> = {};
        data.constructorArgs.forEach(arg => {
          defaults[arg.name] = '';
        });
        setConstructorValues(defaults);
      }
    } catch (err) {
      setStep('error');
      setErrorMsg(`Compile error: ${err}`);
    }
  }, [code, selectedContract]);

  const parseConstructorArg = (value: string, type: string): unknown => {
    if (type === 'bool') return value.toLowerCase() === 'true';
    if (type.startsWith('uint') || type.startsWith('int')) return BigInt(value);
    if (type === 'address') return value as `0x${string}`;
    if (type.includes('[]')) {
      try { return JSON.parse(value); }
      catch { return value.split(',').map(v => v.trim()); }
    }
    return value;
  };

  const handleDeploy = async () => {
    if (!walletClient || !compileResult?.abi || !compileResult?.bytecode || !publicClient) {
      setErrorMsg('Wallet not connected or contract not compiled');
      return;
    }

    setStep('deploying');
    setErrorMsg('');
    setGasEstimate(null);

    try {
      // Parse constructor args
      const args = (compileResult.constructorArgs || []).map(arg =>
        parseConstructorArg(constructorValues[arg.name] || '', arg.type)
      );

      // Estimate gas
      try {
        const estimate = await publicClient.estimateGas({
          account: address,
          data: compileResult.bytecode as `0x${string}`,
        });
        setGasEstimate(estimate.toString());
      } catch {
        // Gas estimation may fail for contracts with constructor args — proceed anyway
      }

      // Deploy
      const hash = await walletClient.deployContract({
        abi: compileResult.abi as readonly unknown[],
        bytecode: compileResult.bytecode as `0x${string}`,
        args: args.length > 0 ? args : undefined,
      });

      setDeployResult({ hash });

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      setDeployResult({
        hash,
        address: receipt.contractAddress || undefined,
      });
      setStep('deployed');

      // Save to deployment history
      if (receipt.contractAddress && chainId) {
        addDeployRecord({
          contractName: compileResult.contractName || 'Unknown',
          address: receipt.contractAddress,
          txHash: hash,
          chain: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
          chainId,
          chainType: 'evm',
          network: TESTNET_IDS.has(chainId) ? 'testnet' : 'mainnet',
        });
      }
    } catch (err) {
      setStep('error');
      const errStr = String(err);
      // Map common errors to friendly messages
      const errorMap: Array<{ pattern: string; message: string }> = [
        { pattern: 'User rejected', message: 'Transaction rejected by user' },
        { pattern: 'user rejected', message: 'Transaction rejected by user' },
        { pattern: 'insufficient funds', message: 'Insufficient funds for deployment. Try a testnet faucet above.' },
        { pattern: 'nonce too low', message: 'Nonce conflict — a pending transaction exists. Try resetting your wallet nonce.' },
        { pattern: 'nonce too high', message: 'Nonce gap detected. Reset your wallet nonce or wait for pending transactions.' },
        { pattern: 'gas required exceeds', message: 'Contract exceeds block gas limit. Try a chain with higher limits or optimize your contract.' },
        { pattern: 'execution reverted', message: 'Constructor reverted during deployment. Check constructor arguments.' },
        { pattern: 'code size limit', message: 'Contract exceeds 24KB code size limit. Split into libraries or optimize.' },
        { pattern: 'chain mismatch', message: 'Wrong network selected in wallet. Switch to the correct chain.' },
        { pattern: 'disconnected', message: 'Wallet disconnected. Please reconnect and try again.' },
        { pattern: 'timeout', message: 'Transaction timed out. Check your wallet for pending transactions.' },
        { pattern: 'already known', message: 'Transaction already submitted. Check your wallet for pending transactions.' },
        { pattern: 'replacement underpriced', message: 'Gas price too low to replace pending transaction. Increase gas or wait.' },
      ];

      const matched = errorMap.find(e => errStr.toLowerCase().includes(e.pattern.toLowerCase()));
      setErrorMsg(matched?.message || (errStr.length > 200 ? errStr.slice(0, 200) + '...' : errStr));
    }
  };

  const chainName = chainId ? CHAIN_NAMES[chainId] || `Chain ${chainId}` : 'Unknown';

  return (
    <div className="deploy-panel">
      <div className="deploy-panel-header">
        <div>
          <span className="deploy-panel-title">🚀 Deploy Contract</span>
          {compileResult?.solcVersion && (
            <span className="deploy-solc-version">solc {compileResult.solcVersion}</span>
          )}
        </div>
        <button className="deploy-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Step 1: Wallet Connection */}
      <div className="deploy-section">
        <div className="deploy-section-label">WALLET</div>
        {!isConnected ? (
          <div className="deploy-connect-prompt">
            <p>Connect your wallet to deploy</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="deploy-wallet-info">
            <div className="deploy-wallet-row">
              <span className="deploy-wallet-address">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className="deploy-chain-badge">{chainName}</span>
            </div>
            {/* Network switcher */}
            <div className="deploy-network-row">
              <span className="deploy-label">Network:</span>
              <select
                className="deploy-network-select"
                value={chainId || ''}
                onChange={(e) => switchChain?.({ chainId: Number(e.target.value) })}
              >
                {Object.entries(CHAIN_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            {/* Faucet links for testnets */}
            {chainId && TESTNET_FAUCETS[chainId] && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Faucets:</span>
                {TESTNET_FAUCETS[chainId].map(f => (
                  <a key={f.name} href={f.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>
                    {f.name} ↗
                  </a>
                ))}
              </div>
            )}
            {/* Balance */}
            {balance !== null && (
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Balance: <span style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{balance}</span>
                {chainId && TESTNET_IDS.has(chainId) && (
                  <span style={{ fontSize: '10px', color: '#eab308', marginLeft: '6px' }}>TESTNET</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Compilation */}
      <div className="deploy-section">
        <div className="deploy-section-label">COMPILE</div>
        {step === 'compiling' && (
          <div className="deploy-status compiling">
            <span className="deploy-spinner">⟳</span> Compiling contract...
          </div>
        )}
        {step === 'error' && (
          <div className="deploy-status error">
            <pre className="deploy-error-msg">{errorMsg}</pre>
            <button className="deploy-retry-btn" onClick={handleCompile}>Retry Compilation</button>
          </div>
        )}
        {compileResult?.success && (
          <div className="deploy-compile-result">
            <div className="deploy-compile-row">
              <span>✓ {compileResult.contractName}</span>
              <span className="deploy-size-badge">
                {((compileResult.bytecode?.length || 0) / 2).toLocaleString()} bytes
              </span>
            </div>
            {(compileResult.availableContracts?.length || 0) > 1 && (
              <select
                className="deploy-contract-select"
                value={selectedContract}
                onChange={(e) => {
                  setSelectedContract(e.target.value);
                  handleCompile();
                }}
              >
                {compileResult.availableContracts?.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {compileResult.gasEstimates?.total && (
              <div className="deploy-gas-row">
                <span className="deploy-label">Est. Gas:</span>
                <span>{Number(compileResult.gasEstimates.total).toLocaleString()}</span>
              </div>
            )}
            {(compileResult.warnings?.length || 0) > 0 && (
              <div className="deploy-warnings">
                {compileResult.warnings?.map((w, i) => (
                  <div key={i} className="deploy-warning-item">⚠️ {w.message.split('\n')[0]}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Constructor Args */}
      {compileResult?.success && (compileResult.constructorArgs?.length || 0) > 0 && (
        <div className="deploy-section">
          <div className="deploy-section-label">CONSTRUCTOR ARGUMENTS</div>
          {compileResult.constructorArgs?.map(arg => (
            <div key={arg.name} className="deploy-arg-row">
              <label className="deploy-arg-label">
                {arg.name} <span className="deploy-arg-type">({arg.type})</span>
              </label>
              <input
                type="text"
                className="deploy-arg-input"
                placeholder={`Enter ${arg.type}...`}
                value={constructorValues[arg.name] || ''}
                onChange={(e) => setConstructorValues(prev => ({ ...prev, [arg.name]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Deploy */}
      {compileResult?.success && isConnected && (
        <div className="deploy-section">
          {step === 'deploying' && (
            <div className="deploy-status deploying">
              <span className="deploy-spinner">⟳</span> Deploying to {chainName}...
              {gasEstimate && <span className="deploy-gas-info">Gas: {Number(gasEstimate).toLocaleString()}</span>}
            </div>
          )}
          {step === 'deployed' && deployResult && (
            <div className="deploy-success">
              <div className="deploy-success-icon">✓</div>
              <div className="deploy-success-title">Contract Deployed!</div>
              {deployResult.address && (
                <div className="deploy-address-row">
                  <span className="deploy-label">Address:</span>
                  <code className="deploy-address">{deployResult.address}</code>
                  <button
                    className="deploy-copy-btn"
                    onClick={() => navigator.clipboard.writeText(deployResult.address || '')}
                  >⎘</button>
                </div>
              )}
              <div className="deploy-address-row">
                <span className="deploy-label">Tx:</span>
                <code className="deploy-address">{deployResult.hash.slice(0, 10)}...{deployResult.hash.slice(-8)}</code>
              </div>
              {chainId && EXPLORER_URLS[chainId] && deployResult.address && (
                <a
                  href={`${EXPLORER_URLS[chainId]}/address/${deployResult.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '10px',
                    padding: '8px 16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px', color: '#6366f1', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
                >
                  View on Explorer ↗
                </a>
              )}
            </div>
          )}
          {(step === 'compiled' || step === 'error') && (
            <button
              className="deploy-btn"
              onClick={handleDeploy}
              disabled={!isConnected || !compileResult?.success}
            >
              🚀 Deploy to {chainName}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
