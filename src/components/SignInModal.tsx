'use client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  if (!isOpen) return null;

  return (
    <div className="signin-overlay" onClick={onClose}>
      <div className="signin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="signin-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="signin-icon">
          <svg viewBox="0 0 80 80" width="48" height="48">
            <polygon points="40,4 76,28 62,68 18,68 4,28" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
            <polygon points="40,14 66,32 55,60 25,60 14,32" fill="none" stroke="var(--color-primary)" strokeWidth="1" opacity="0.4" />
            <circle cx="40" cy="40" r="5" fill="var(--color-primary)" />
          </svg>
        </div>

        <h2 className="signin-title">Sign in to continue</h2>
        <p className="signin-desc">
          Create an account or sign in to start generating and auditing smart contracts.
        </p>

        <a href="/login" className="signin-cta">
          Continue to Sign In →
        </a>

        <p className="signin-note">
          Supports Google, EVM wallets, and Solana wallets
        </p>
      </div>
    </div>
  );
}
