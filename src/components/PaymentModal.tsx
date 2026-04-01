'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  PACKS,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  ERC20_TRANSFER_ABI,
  STABLECOINS,
  NATIVE_TOKENS,
  type PaymentToken,
  type CreditType,
} from '@/lib/payments';

// ─── Types ─────────────────────────────────────────────────
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (creditType: CreditType, creditsAdded: number) => void;
  packId: string;
  creditType: CreditType;
  userId: string;
}

type PaymentStep = 'select' | 'confirm' | 'processing' | 'verifying' | 'success' | 'error';

// ─── Chain detection ───────────────────────────────────────
function chainIdToName(chainId: number | undefined): string {
  const map: Record<number, string> = {
    1: 'ethereum', 137: 'polygon', 56: 'bsc',
    42161: 'arbitrum', 8453: 'base', 10: 'optimism', 43114: 'avalanche',
  };
  return chainId ? map[chainId] || 'ethereum' : 'ethereum';
}

// ─── Component ─────────────────────────────────────────────
export function PaymentModal({ isOpen, onClose, onSuccess, packId, creditType, userId }: PaymentModalProps) {
  const pack = PACKS[packId];

  // Wallet states
  const { address: evmAddress, chainId, isConnected: evmConnected } = useAccount();
  const { publicKey: solanaKey, sendTransaction: solanaSend, connected: solConnected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: openSolanaModal } = useWalletModal();
  const { openConnectModal } = useConnectModal();

  // Transaction hooks
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // State
  const [selectedToken, setSelectedToken] = useState<PaymentToken>('USDC');
  const [step, setStep] = useState<PaymentStep>('select');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [convertedAmount, setConvertedAmount] = useState<{ tokenAmount: number; priceUsd: number } | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const isSolanaToken = selectedToken === 'SOL' || (!evmConnected && solConnected);
  const chainName = isSolanaToken ? 'solana' : chainIdToName(chainId);

  // ─── Fetch conversion rate for native tokens ───
  useEffect(() => {
    if (!isOpen) return;
    if (STABLECOINS.includes(selectedToken)) {
      setConvertedAmount(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingPrice(true);
      try {
        const res = await fetch(`/api/price-quote?token=${selectedToken}&usd=${pack.price}`);
        const data = await res.json();
        if (!cancelled) setConvertedAmount(data);
      } catch {
        if (!cancelled) setConvertedAmount(null);
      } finally {
        if (!cancelled) setLoadingPrice(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedToken, isOpen, pack.price]);

  // ─── Reset on open ───
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setTxHash('');
      setErrorMsg('');
      setSelectedToken('USDC');
    }
  }, [isOpen]);

  // ─── EVM Stablecoin Payment ───
  const payERC20 = useCallback(async () => {
    if (!evmAddress) return;
    const tokenAddr = TOKEN_ADDRESSES[chainName]?.[selectedToken];
    if (!tokenAddr) throw new Error(`${selectedToken} not available on ${chainName}`);

    const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS;
    if (!treasury) throw new Error('Treasury address not configured');

    const decimals = TOKEN_DECIMALS[selectedToken] || 6;
    const amount = parseUnits(String(pack.price), decimals);

    const hash = await writeContractAsync({
      address: tokenAddr as Address,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [treasury as Address, amount],
    });

    return hash;
  }, [evmAddress, chainName, selectedToken, pack.price, writeContractAsync]);

  // ─── EVM Native Token Payment ───
  const payNative = useCallback(async () => {
    if (!evmAddress || !convertedAmount) return;

    const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS;
    if (!treasury) throw new Error('Treasury address not configured');

    const decimals = TOKEN_DECIMALS[selectedToken] || 18;
    const amount = parseUnits(convertedAmount.tokenAmount.toFixed(decimals > 8 ? 8 : decimals), decimals);

    const hash = await sendTransactionAsync({
      to: treasury as Address,
      value: amount,
    });

    return hash;
  }, [evmAddress, convertedAmount, selectedToken, sendTransactionAsync]);

  // ─── Solana SPL Payment ───
  const paySolSPL = useCallback(async () => {
    if (!solanaKey) return;
    const treasury = process.env.NEXT_PUBLIC_TREASURY_SOLANA_ADDRESS;
    if (!treasury) throw new Error('Solana treasury address not configured');

    const mint = new PublicKey(TOKEN_ADDRESSES.solana[selectedToken]);
    const treasuryPubkey = new PublicKey(treasury);

    const senderATA = await getAssociatedTokenAddress(mint, solanaKey);
    const receiverATA = await getAssociatedTokenAddress(mint, treasuryPubkey);

    const decimals = TOKEN_DECIMALS[selectedToken] || 6;
    const amount = Math.round(pack.price * 10 ** decimals);

    const instruction = createTransferInstruction(
      senderATA,
      receiverATA,
      solanaKey,
      amount
    );

    const tx = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = solanaKey;

    const sig = await solanaSend(tx, connection);
    return sig;
  }, [solanaKey, selectedToken, pack.price, connection, solanaSend]);

  // ─── Solana Native Payment ───
  const paySolNative = useCallback(async () => {
    if (!solanaKey || !convertedAmount) return;
    const treasury = process.env.NEXT_PUBLIC_TREASURY_SOLANA_ADDRESS;
    if (!treasury) throw new Error('Solana treasury address not configured');

    const lamports = Math.round(convertedAmount.tokenAmount * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: solanaKey,
        toPubkey: new PublicKey(treasury),
        lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = solanaKey;

    const sig = await solanaSend(tx, connection);
    return sig;
  }, [solanaKey, convertedAmount, connection, solanaSend]);

  // ─── Pay handler ───
  const handlePay = async () => {
    setStep('processing');
    setErrorMsg('');

    try {
      let hash: string | undefined;

      if (isSolanaToken || chainName === 'solana') {
        // Solana path
        if (selectedToken === 'SOL') {
          hash = await paySolNative();
        } else {
          hash = await paySolSPL();
        }
      } else {
        // EVM path
        if (NATIVE_TOKENS.includes(selectedToken)) {
          hash = await payNative();
        } else {
          hash = await payERC20();
        }
      }

      if (!hash) throw new Error('Transaction not submitted');
      setTxHash(hash);
      setStep('verifying');

      // Verify on server
      const verifyUrl = chainName === 'solana' ? '/api/verify-payment/solana' : '/api/verify-payment';
      const res = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: hash,
          chain: chainName,
          token: selectedToken,
          expectedUsd: pack.price,
          creditsType: creditType,
          creditsAmount: pack.credits,
          userId,
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Verification failed');

      setStep('success');
      setTimeout(() => {
        onSuccess(creditType, pack.credits);
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      // User rejected
      if (msg.includes('rejected') || msg.includes('denied') || msg.includes('cancelled')) {
        setStep('select');
        return;
      }
      setErrorMsg(msg);
      setStep('error');
    }
  };

  // ─── Wallet connection check ───
  const isWalletConnected = isSolanaToken ? solConnected : evmConnected;

  const connectWallet = () => {
    if (isSolanaToken) {
      openSolanaModal(true);
    } else {
      openConnectModal?.();
    }
  };

  if (!isOpen || !pack) return null;

  // ─── Available tokens for current chain ───
  const availableTokens: PaymentToken[] = [];
  if (isSolanaToken || (!evmConnected && !solConnected)) {
    if (TOKEN_ADDRESSES.solana?.USDC) availableTokens.push('USDC');
    if (TOKEN_ADDRESSES.solana?.USDT) availableTokens.push('USDT');
    availableTokens.push('SOL');
  }
  if (!isSolanaToken || (!evmConnected && !solConnected)) {
    const tokens = TOKEN_ADDRESSES[chainName] || {};
    if (tokens.USDC && !availableTokens.includes('USDC')) availableTokens.push('USDC');
    if (tokens.USDT && !availableTokens.includes('USDT')) availableTokens.push('USDT');
    if (['ethereum'].includes(chainName)) availableTokens.push('ETH');
    if (['bsc'].includes(chainName)) availableTokens.push('BNB');
  }

  return (
    <div className="payment-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && step === 'select') onClose(); }}>
      <div className="payment-modal">
        {/* Header */}
        <div className="pm-header">
          <h3>Complete Payment</h3>
          {step === 'select' && (
            <button className="pm-close" onClick={onClose}>✕</button>
          )}
        </div>

        {/* Order Summary */}
        <div className="pm-summary">
          <div className="pm-summary-row">
            <span>{pack.label}</span>
            <span className="pm-price">${pack.price}</span>
          </div>
          <div className="pm-summary-detail">
            {pack.credits} {creditType}{pack.credits > 1 ? 's' : ''} • {pack.perUnit > 0 ? `$${pack.perUnit}/each` : ''}
            {pack.savings > 0 && <span className="pm-savings">Save ${pack.savings}</span>}
          </div>
        </div>

        {/* Step: Token Selection */}
        {step === 'select' && (
          <div className="pm-body">
            <label className="pm-label">Pay with</label>
            <div className="pm-token-grid">
              {availableTokens.map(token => (
                <button
                  key={token}
                  className={`pm-token-btn ${selectedToken === token ? 'active' : ''}`}
                  onClick={() => setSelectedToken(token)}
                >
                  <span className="pm-token-icon">{tokenIcon(token)}</span>
                  <span>{token}</span>
                </button>
              ))}
            </div>

            {/* Conversion display for native tokens */}
            {NATIVE_TOKENS.includes(selectedToken) && (
              <div className="pm-conversion">
                {loadingPrice ? (
                  <span className="pm-loading-price">Fetching live price...</span>
                ) : convertedAmount ? (
                  <>
                    <span>≈ {convertedAmount.tokenAmount.toFixed(6)} {selectedToken}</span>
                    <span className="pm-rate">@ ${convertedAmount.priceUsd.toLocaleString()} per {selectedToken}</span>
                  </>
                ) : (
                  <span className="pm-loading-price">Price unavailable</span>
                )}
              </div>
            )}

            {/* Chain info */}
            <div className="pm-chain-info">
              {isSolanaToken ? '🔗 Solana' : `🔗 ${chainName.charAt(0).toUpperCase() + chainName.slice(1)}`}
              {evmConnected && ` • ${evmAddress?.slice(0, 6)}...${evmAddress?.slice(-4)}`}
              {solConnected && solanaKey && ` • ${solanaKey.toBase58().slice(0, 4)}...${solanaKey.toBase58().slice(-4)}`}
            </div>

            {/* Pay / Connect Button */}
            {isWalletConnected ? (
              <button
                className="pm-pay-btn"
                onClick={handlePay}
                disabled={NATIVE_TOKENS.includes(selectedToken) && !convertedAmount}
              >
                Pay ${pack.price} with {selectedToken}
              </button>
            ) : (
              <button className="pm-pay-btn" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="pm-body pm-center">
            <div className="pm-spinner" />
            <p>Waiting for wallet confirmation...</p>
            <p className="pm-sub">Please confirm the transaction in your wallet</p>
          </div>
        )}

        {/* Step: Verifying */}
        {step === 'verifying' && (
          <div className="pm-body pm-center">
            <div className="pm-spinner" />
            <p>Verifying on-chain...</p>
            <p className="pm-sub">{txHash.slice(0, 10)}...{txHash.slice(-6)}</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="pm-body pm-center">
            <div className="pm-success-icon">✓</div>
            <p>Payment confirmed!</p>
            <p className="pm-sub">{pack.credits} credit{pack.credits > 1 ? 's' : ''} added</p>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="pm-body pm-center">
            <div className="pm-error-icon">✗</div>
            <p>Payment failed</p>
            <p className="pm-sub pm-error-text">{errorMsg}</p>
            <button className="pm-pay-btn" onClick={() => setStep('select')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Token icons (simple emoji/text fallback) ───
function tokenIcon(token: PaymentToken): string {
  const icons: Record<PaymentToken, string> = {
    USDC: '💵', USDT: '💲', ETH: 'Ξ', SOL: '◎', BNB: '🔶',
  };
  return icons[token] || '🪙';
}
