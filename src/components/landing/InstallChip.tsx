'use client';

import { useState } from 'react';
import { CheckIcon } from './Icons';

type Props = {
  command: string;
  size?: 'sm' | 'md';
  className?: string;
};

export function InstallChip({ command, size = 'md', className }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`m-install ${size === 'sm' ? 'm-install--sm' : ''} ${className ?? ''}`}
      aria-label={copied ? 'Copied install command' : 'Copy install command'}
    >
      <span className="m-install-prompt" aria-hidden="true">$</span>
      <span className="m-install-cmd">{command}</span>
      <span className="m-install-action" aria-hidden="true">
        {copied ? (
          <>
            <CheckIcon /> Copied
          </>
        ) : (
          'Copy'
        )}
      </span>
    </button>
  );
}
