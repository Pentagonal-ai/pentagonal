import type { Metadata } from 'next';
import MessengerMount from './MessengerMount';

export const metadata: Metadata = {
  title: 'Qcipher — quantum-safe encrypted messaging',
};

export default function MessagesPage() {
  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '40px 16px',
        background: '#0a0b0f',
        backgroundImage:
          'radial-gradient(60% 45% at 50% 0%, rgba(94,234,212,.06), transparent 70%), radial-gradient(55% 45% at 82% 100%, rgba(127,119,221,.08), transparent 70%)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#e9ebf2', fontSize: 20, fontWeight: 500, margin: 0 }}>Qcipher</h1>
        <p style={{ color: '#8b92a1', fontSize: 12, margin: '4px 0 0' }}>
          encrypted messages, written on-chain, behind a cipher the chain rotates
        </p>
      </div>
      <MessengerMount />
    </main>
  );
}
