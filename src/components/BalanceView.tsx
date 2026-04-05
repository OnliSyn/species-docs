'use client';

import { cn } from '@/lib/utils';
import { useTabStore } from '@/stores/tab-store';
import { formatUsdcDisplay, formatSpecieCount } from '@/lib/amount';

interface BalanceViewProps {
  fundingBalance: bigint;
  assetBalance: bigint;
  specieCount: number;
  isReconciled: boolean;
}

export function BalanceView({ fundingBalance, assetBalance, specieCount, isReconciled }: BalanceViewProps) {
  const { balanceView, setBalanceView } = useTabStore();
  const isFunding = balanceView === 'funding';

  const displayBalance = isFunding ? fundingBalance : assetBalance;
  const formatted = formatUsdcDisplay(displayBalance);
  // Split "$12,450.00" into "$12,450" and ".00"
  const dotIndex = formatted.lastIndexOf('.');
  const wholePart = dotIndex >= 0 ? formatted.slice(0, dotIndex) : formatted;
  const centsPart = dotIndex >= 0 ? formatted.slice(dotIndex) : '';

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Portfolio
        </h3>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M16 14h2" />
        </svg>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)] mb-5">
        {(['funding', 'asset'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setBalanceView(view)}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] rounded-[var(--radius-input)] transition-all',
              balanceView === view
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)]'
            )}
          >
            {view}
          </button>
        ))}
      </div>

      {/* Balance */}
      <div className="text-center">
        {isFunding ? (
          <p className="text-[36px] font-bold leading-tight">
            <span className="text-[var(--color-text-primary)]">{wholePart}</span>
            <span className="text-[var(--color-text-secondary)] font-normal text-[24px]">{centsPart}</span>
          </p>
        ) : (
          <>
            <p className="text-[36px] font-bold text-[var(--color-text-primary)] leading-tight">
              {formatSpecieCount(specieCount)}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {'\u2248'} {formatUsdcDisplay(assetBalance)}
            </p>
          </>
        )}

        {/* Reconciliation warning */}
        {!isFunding && !isReconciled && (
          <div className="mt-3 px-3 py-1.5 rounded-[var(--radius-input)] bg-[var(--color-accent-amber)]/20 text-xs text-[var(--color-text-primary)]">
            {'\u26A0'} Balance discrepancy detected
          </div>
        )}
      </div>
    </div>
  );
}
