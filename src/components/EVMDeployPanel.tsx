'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

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
    } catch (err) {
      setStep('error');
      const errStr = String(err);
      if (errStr.includes('User rejected') || errStr.includes('user rejected')) {
        setErrorMsg('Transaction rejected by user');
      } else if (errStr.includes('insufficient funds')) {
        setErrorMsg('Insufficient funds for deployment');
      } else {
        setErrorMsg(errStr.length > 200 ? errStr.slice(0, 200) + '...' : errStr);
      }
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
