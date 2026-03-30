'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Keypair,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

type DeployStep = 'connect' | 'configure' | 'creating' | 'minting' | 'done' | 'error';

interface SolanaDeployPanelProps {
  code: string; // The generated token config / code
  onClose: () => void;
}

// Try to parse token info from AI-generated output
function parseTokenInfo(code: string): { name: string; symbol: string; decimals: number; supply: number } {
  const defaults = { name: 'My Token', symbol: 'MTK', decimals: 9, supply: 1000000 };

  // Try JSON parse first
  try {
    const json = JSON.parse(code);
    return {
      name: json.name || defaults.name,
      symbol: json.symbol || defaults.symbol,
      decimals: json.decimals ?? defaults.decimals,
      supply: json.supply || json.totalSupply || json.initialSupply || defaults.supply,
    };
  } catch {
    // Try regex extraction from code/text
    const nameMatch = code.match(/name[:\s=]*["']([^"']+)["']/i);
    const symbolMatch = code.match(/symbol[:\s=]*["']([^"']+)["']/i);
    const decimalsMatch = code.match(/decimals[:\s=]*(\d+)/i);
    const supplyMatch = code.match(/(?:total_?supply|supply|initial_?supply)[:\s=]*(\d[\d_,]*)/i);

    return {
      name: nameMatch?.[1] || defaults.name,
      symbol: symbolMatch?.[1] || defaults.symbol,
      decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : defaults.decimals,
      supply: supplyMatch ? parseInt(supplyMatch[1].replace(/[_,]/g, '')) : defaults.supply,
    };
  }
}

export function SolanaDeployPanel({ code, onClose }: SolanaDeployPanelProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const parsed = parseTokenInfo(code);

  const [tokenName, setTokenName] = useState(parsed.name);
  const [tokenSymbol, setTokenSymbol] = useState(parsed.symbol);
  const [decimals, setDecimals] = useState(parsed.decimals);
  const [supply, setSupply] = useState(parsed.supply);
  const [step, setStep] = useState<DeployStep>(connected ? 'configure' : 'connect');
  const [errorMsg, setErrorMsg] = useState('');
  const [mintAddress, setMintAddress] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [isDevnet, setIsDevnet] = useState(true);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [airdropMsg, setAirdropMsg] = useState('');

  // Update step when wallet connects
  if (connected && step === 'connect') {
    setStep('configure');
  }

  const handleAirdrop = useCallback(async () => {
    if (!publicKey) return;
    setAirdropLoading(true);
    setAirdropMsg('');
    try {
      const sig = await connection.requestAirdrop(publicKey, 1_000_000_000); // 1 SOL
      await connection.confirmTransaction(sig, 'confirmed');
      setAirdropMsg('✓ 1 SOL airdropped!');
    } catch (err) {
      setAirdropMsg(`Airdrop failed: ${String(err).slice(0, 80)}`);
    }
    setAirdropLoading(false);
  }, [publicKey, connection]);

  const handleCreateToken = useCallback(async () => {
    if (!publicKey || !connected) {
      setErrorMsg('Wallet not connected');
      return;
    }

    setStep('creating');
    setErrorMsg('');

    try {
      // Generate a new keypair for the mint
      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      // Build transaction: create mint account + initialize mint
      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey, // mint authority
          publicKey, // freeze authority (same as creator)
        ),
      );

      // Get associated token account for the creator
      const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, publicKey);

      // Add ATA creation + mint instructions
      tx.add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          ata,       // associated token account
          publicKey, // owner
          mintKeypair.publicKey, // mint
        ),
        createMintToInstruction(
          mintKeypair.publicKey, // mint
          ata,                  // destination
          publicKey,            // authority
          BigInt(supply) * BigInt(10 ** decimals), // amount with decimals
        ),
      );

      setStep('minting');

      // Send transaction — mint keypair must be a signer
      const signature = await sendTransaction(tx, connection, {
        signers: [mintKeypair],
      });

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      setMintAddress(mintKeypair.publicKey.toBase58());
      setTxSignature(signature);
      setStep('done');
    } catch (err) {
      setStep('error');
      const errStr = String(err);
      if (errStr.includes('User rejected') || errStr.includes('rejected')) {
        setErrorMsg('Transaction cancelled by user');
      } else if (errStr.includes('insufficient') || errStr.includes('Insufficient')) {
        setErrorMsg('Insufficient SOL balance. Use the airdrop button on devnet.');
      } else {
        setErrorMsg(errStr.length > 150 ? errStr.slice(0, 150) + '...' : errStr);
      }
    }
  }, [publicKey, connected, connection, sendTransaction, decimals, supply]);

  const solscanBase = isDevnet ? 'https://solscan.io' : 'https://solscan.io';
  const solscanParams = isDevnet ? '?cluster=devnet' : '';

  return (
    <div className="deploy-panel solana-deploy">
      <div className="deploy-panel-header">
        <div>
          <span className="deploy-panel-title">◐ Create SPL Token</span>
          <span className="deploy-solc-version">{isDevnet ? 'Devnet' : 'Mainnet'}</span>
        </div>
        <button className="deploy-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Network Toggle */}
      <div className="deploy-section">
        <div className="deploy-section-label">NETWORK</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`solana-net-btn ${isDevnet ? 'active' : ''}`}
            onClick={() => setIsDevnet(true)}
          >
            Devnet
          </button>
          <button
            className={`solana-net-btn ${!isDevnet ? 'active' : ''}`}
            onClick={() => setIsDevnet(false)}
          >
            Mainnet
          </button>
          {isDevnet && connected && (
            <button
              className="solana-airdrop-btn"
              onClick={handleAirdrop}
              disabled={airdropLoading}
            >
              {airdropLoading ? '⟳' : '💧'} Get 1 SOL
            </button>
          )}
        </div>
        {airdropMsg && (
          <div style={{ fontSize: '12px', marginTop: '6px', color: airdropMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>
            {airdropMsg}
          </div>
        )}
        {!isDevnet && (
          <div style={{ fontSize: '11px', color: '#eab308', marginTop: '6px' }}>
            ⚠️ Mainnet deployments use real SOL. Test on devnet first.
          </div>
        )}
      </div>

      {/* Wallet */}
      <div className="deploy-section">
        <div className="deploy-section-label">WALLET</div>
        {!connected ? (
          <div className="deploy-connect-prompt">
            <p>Connect your Solana wallet</p>
            <WalletMultiButton />
          </div>
        ) : (
          <div className="deploy-wallet-info">
            <div className="deploy-wallet-row">
              <span className="deploy-wallet-address">
                {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}
              </span>
              <span className="deploy-chain-badge" style={{ borderColor: 'rgba(148, 84, 255, 0.3)', color: '#9454ff' }}>
                Solana
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Token Config */}
      {connected && (step === 'configure' || step === 'error') && (
        <div className="deploy-section">
          <div className="deploy-section-label">TOKEN CONFIGURATION</div>
          <div className="deploy-arg-row">
            <label className="deploy-arg-label">Name</label>
            <input
              type="text"
              className="deploy-arg-input"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="My Token"
            />
          </div>
          <div className="deploy-arg-row">
            <label className="deploy-arg-label">Symbol</label>
            <input
              type="text"
              className="deploy-arg-input"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              placeholder="MTK"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="deploy-arg-row" style={{ flex: 1 }}>
              <label className="deploy-arg-label">Decimals</label>
              <input
                type="number"
                className="deploy-arg-input"
                value={decimals}
                onChange={(e) => setDecimals(parseInt(e.target.value) || 0)}
                min={0}
                max={18}
              />
            </div>
            <div className="deploy-arg-row" style={{ flex: 2 }}>
              <label className="deploy-arg-label">Initial Supply</label>
              <input
                type="number"
                className="deploy-arg-input"
                value={supply}
                onChange={(e) => setSupply(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Mint + Freeze authority: your connected wallet. Cost: ~0.002 SOL (rent).
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="deploy-section">
          <div className="deploy-status error">
            <pre className="deploy-error-msg">{errorMsg}</pre>
          </div>
        </div>
      )}

      {/* Progress */}
      {(step === 'creating' || step === 'minting') && (
        <div className="deploy-section">
          <div className="deploy-status deploying">
            <span className="deploy-spinner">⟳</span>
            {step === 'creating' ? 'Creating mint account...' : 'Minting tokens...'}
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'done' && (
        <div className="deploy-section">
          <div className="deploy-success">
            <div className="deploy-success-icon">✓</div>
            <div className="deploy-success-title">Token Created!</div>
            <div style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '8px' }}>
              {tokenName} ({tokenSymbol})
            </div>
            <div className="deploy-address-row">
              <span className="deploy-label">Mint:</span>
              <code className="deploy-address">{mintAddress.slice(0, 8)}...{mintAddress.slice(-6)}</code>
              <button
                className="deploy-copy-btn"
                onClick={() => navigator.clipboard.writeText(mintAddress)}
              >⎘</button>
            </div>
            <div className="deploy-address-row">
              <span className="deploy-label">Tx:</span>
              <code className="deploy-address">{txSignature.slice(0, 8)}...{txSignature.slice(-6)}</code>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
              <a
                href={`${solscanBase}/token/${mintAddress}${solscanParams}`}
                target="_blank"
                rel="noopener noreferrer"
                className="solana-explorer-link"
              >
                View on Solscan ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Button */}
      {connected && (step === 'configure' || step === 'error') && (
        <div className="deploy-section">
          <button
            className="deploy-btn"
            onClick={handleCreateToken}
            style={{ background: 'linear-gradient(135deg, #9454ff, #6366f1)' }}
          >
            ◐ Create {tokenSymbol} Token on {isDevnet ? 'Devnet' : 'Mainnet'}
          </button>
        </div>
      )}
    </div>
  );
}
