import type { Metadata } from 'next';
import MessengerMount from './MessengerMount';
import './messenger.css';

export const metadata: Metadata = {
  title: 'Qcipher — quantum-safe encrypted messaging',
};

export default function MessagesPage() {
  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '26px 16px',
        background: '#0a0908',
        backgroundImage:
          'radial-gradient(60% 40% at 50% 0%, rgba(103,232,249,.05), transparent 70%), radial-gradient(55% 45% at 88% 110%, rgba(167,139,250,.06), transparent 70%)',
      }}
    >
      <MessengerMount />
    </main>
  );
}
