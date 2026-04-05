'use client';

import { useState, useEffect } from 'react';
import type { DepositStatus } from '@/types';

interface DepositFlowProps {
  amount: string;
  onComplete: () => void;
  onCancel: () => void;
}

const DEPOSIT_STEPS: { status: DepositStatus; label: string }[] = [
  { status: 'detected', label: 'Deposit detected' },
  { status: 'awaiting_confirmations', label: 'Awaiting confirmations' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'credited', label: 'Credited to account' },
];

export function DepositFlow({ amount, onComplete, onCancel }: DepositFlowProps) {
  const [currentStatus, setCurrentStatus] = useState<DepositStatus>('detected');
  const [showAddress, setShowAddress] = useState(true);
  const depositAddress = '0x742d35Cc6634C0532925a3b844Bc7e0199f01E23';

  // Simulate deposit progression
  useEffect(() => {
    if (!showAddress) {
      const stages: DepositStatus[] = ['detected', 'awaiting_confirmations', 'confirmed', 'credited'];
      let idx = 0;
      const timer = setInterval(() => {
        idx++;
        if (idx < stages.length) {
          setCurrentStatus(stages[idx]);
        } else {
          clearInterval(timer);
        }
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [showAddress]);

  if (showAddress) {
    return (
      <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
          Deposit USDC
        </h3>
        <p className="text-sm mb-3">Send <strong>${amount}</strong> USDC to:</p>
        <div className="p-3 bg-[var(--color-bg-card)] rounded-[var(--radius-input)] font-mono text-xs break-all mb-4">
          {depositAddress}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(depositAddress);
            }}
            className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold"
          >
            Copy Address
          </button>
          <button
            onClick={() => setShowAddress(false)}
            className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-accent-green)] text-[var(--color-text-primary)] text-sm font-semibold"
          >
            I've Sent It
          </button>
        </div>
        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  const currentIdx = DEPOSIT_STEPS.findIndex(s => s.status === currentStatus);

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">
        Deposit Progress
      </h3>
      <div className="space-y-3">
        {DEPOSIT_STEPS.map((step, i) => (
          <div key={step.status} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < currentIdx ? 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]'
              : i === currentIdx ? 'bg-[var(--color-cta-primary)] text-white animate-pulse'
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
            }`}>
              {i < currentIdx ? '\u2713' : i + 1}
            </div>
            <span className={`text-sm ${
              i <= currentIdx ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
            } ${i === currentIdx ? 'font-medium' : ''}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      {currentStatus === 'credited' && (
        <button
          onClick={onComplete}
          className="w-full mt-4 py-2 rounded-[var(--radius-button)] bg-[var(--color-accent-green)] text-[var(--color-text-primary)] text-sm font-semibold"
        >
          Done
        </button>
      )}
    </div>
  );
}
