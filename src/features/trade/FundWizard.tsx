'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTabStore } from '@/stores/tab-store';
import { formatUsdcDisplay, parseUsdcInput } from '@/lib/amount';

const WALLETS = [
  { id: 'w1', label: 'MetaMask', address: '0x742d...01E23' },
  { id: 'w2', label: 'Coinbase Wallet', address: '0x1a2b...c3d4' },
];

const MARKETSB_ACCOUNT = 'MSB-VA-500-0x8F3a...7B2c';

export function FundWizard() {
  const queryClient = useQueryClient();
  const { fundWizardStep, setFundWizardStep, resetFundWizard } = useTabStore();
  const [amount, setAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState(WALLETS[0].id);
  const [depositStatus, setDepositStatus] = useState<'waiting' | 'detected' | 'confirming' | 'credited'>('waiting');

  // Strip commas for numeric parsing, keep raw digits for state
  const rawDigits = amount.replace(/,/g, '');
  const numericAmount = parseFloat(rawDigits) || 0;
  const baseUnits = numericAmount > 0 ? parseUsdcInput(rawDigits) : 0n;

  // Format with commas for display in the input
  const formatWithCommas = (val: string): string => {
    const clean = val.replace(/,/g, '');
    const parts = clean.split('.');
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${whole}.${parts[1]}` : whole;
  };

  const selectedWalletData = WALLETS.find(w => w.id === selectedWallet);

  const handleConfirm = () => {
    setFundWizardStep(4);
    setDepositStatus('waiting');
    setTimeout(() => setDepositStatus('detected'), 2000);
    setTimeout(() => setDepositStatus('confirming'), 4000);
    setTimeout(() => {
      setDepositStatus('credited');
      // Invalidate account queries so balances refresh from the API layer
      queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-account'] });
    }, 6000);
  };

  const handleDone = () => {
    setAmount('');
    setDepositStatus('waiting');
    resetFundWizard();
  };

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Fund Account
        </h3>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s <= fundWizardStep
                  ? 'bg-[var(--color-accent-green)]'
                  : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Enter Amount */}
      {fundWizardStep === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] mb-2 block">
              Enter Amount
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount ? formatWithCommas(amount) : ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '').replace(/,/g, '');
                setAmount(val);
              }}
              placeholder="0.00"
              className="w-full px-4 py-4 text-[42px] font-extralight tracking-tight text-center rounded-[var(--radius-input)] bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-green)] placeholder:text-[var(--color-border)]"
            />
            {numericAmount > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 text-right">
                {formatUsdcDisplay(baseUnits)}
              </p>
            )}
          </div>
          <button
            onClick={() => numericAmount > 0 && setFundWizardStep(2)}
            disabled={numericAmount <= 0}
            className={`w-full py-3 rounded-[var(--radius-button)] font-semibold text-sm transition-colors ${
              numericAmount > 0
                ? 'bg-[var(--color-cta-primary)] text-white hover:opacity-90'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>
      )}

      {/* Step 2: Select Payment Method */}
      {fundWizardStep === 2 && (
        <div className="space-y-4">
          <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
            Select Payment Method
          </label>
          <div className="space-y-2">
            {WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => setSelectedWallet(wallet.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-[var(--radius-input)] border transition-colors ${
                  selectedWallet === wallet.id
                    ? 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/5'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-card)]'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-xs">
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
                    <path d="M20.5 18.2c0-2.1-1.3-2.8-3.8-3.1-1.8-.3-2.2-.7-2.2-1.5s.6-1.3 1.8-1.3c1.1 0 1.6.4 1.9 1.2.1.2.3.3.5.3h.5c.3 0 .5-.2.5-.5v-.1c-.3-1.1-1.1-2-2.3-2.2v-1.3c0-.3-.2-.5-.5-.5h-.5c-.3 0-.5.2-.5.5v1.2c-1.7.3-2.8 1.3-2.8 2.7 0 2 1.2 2.7 3.7 3 1.6.3 2.3.6 2.3 1.6 0 .9-.8 1.5-2 1.5-1.5 0-2-.6-2.2-1.4-.1-.2-.3-.4-.5-.4h-.6c-.3 0-.5.2-.5.5v.1c.3 1.3 1.3 2.2 2.8 2.5v1.3c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-1.3c1.8-.2 2.8-1.4 2.8-2.9z" fill="white"/>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{wallet.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{wallet.address}</p>
                </div>
                {selectedWallet === wallet.id && (
                  <span className="text-[var(--color-accent-green)] font-bold">&#10003;</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFundWizardStep(1)}
              className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-semibold"
            >
              Back
            </button>
            <button
              onClick={() => setFundWizardStep(3)}
              className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold hover:opacity-90"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review — Amount, From, To, For the Benefit Of */}
      {fundWizardStep === 3 && (
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius-input)] bg-[var(--color-bg-card)] space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-[0.05em]">Amount</span>
              <div className="text-right">
                <span className="text-lg font-bold">{formatUsdcDisplay(baseUnits)}</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-1">USDC</span>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-3 flex justify-between items-baseline">
              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-[0.05em]">From</span>
              <div className="text-right">
                <p className="text-sm font-medium">{selectedWalletData?.label}</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">{selectedWalletData?.address}</p>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-3 flex justify-between items-baseline">
              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-[0.05em]">To</span>
              <div className="text-right">
                <p className="text-sm font-medium">MarketSB Funding VA</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">Code 500 (funding)</p>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-3 flex justify-between items-start">
              <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-[0.05em]">For the<br/>Benefit of</span>
              <div className="text-right">
                <p className="text-sm font-medium">Your Account</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">{MARKETSB_ACCOUNT}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFundWizardStep(2)}
              className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold hover:opacity-90"
            >
              Confirm Deposit
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Track Deposit */}
      {fundWizardStep === 4 && (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-lg font-bold">{formatUsdcDisplay(baseUnits)}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Deposit in progress</p>
          </div>
          <div className="space-y-3">
            {[
              { key: 'detected', label: 'Deposit detected' },
              { key: 'confirming', label: 'Awaiting confirmations' },
              { key: 'credited', label: 'Credited to account' },
            ].map((step, i) => {
              const steps = ['detected', 'confirming', 'credited'];
              const currentIdx = steps.indexOf(depositStatus);
              const isComplete = i < currentIdx || (depositStatus === 'credited' && i <= currentIdx);
              const isCurrent = i === currentIdx && depositStatus !== 'waiting' && depositStatus !== 'credited';

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isComplete ? 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]'
                    : isCurrent ? 'bg-[var(--color-cta-primary)] text-white animate-pulse'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'
                  }`}>
                    {isComplete ? '\u2713' : i + 1}
                  </div>
                  <span className={`text-sm ${isComplete || isCurrent ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {depositStatus === 'credited' && (
            <button
              onClick={handleDone}
              className="w-full py-2.5 rounded-[var(--radius-button)] bg-[var(--color-accent-green)] text-[var(--color-text-primary)] text-sm font-semibold"
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
