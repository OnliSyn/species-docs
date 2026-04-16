'use client';

import { formatUsdcDisplay } from '@/lib/amount';

interface AssuranceCardProps {
  assuranceBalance: bigint;
  totalOutstanding: bigint;
  /** Pre-computed on the server from sim balances (UI does not derive coverage). */
  coveragePercent: number;
}

export function AssuranceCard({ assuranceBalance, totalOutstanding, coveragePercent }: AssuranceCardProps) {

  const statusColor = coveragePercent >= 50
    ? 'var(--color-accent-green)'
    : coveragePercent >= 25
      ? 'var(--color-accent-amber)'
      : 'var(--color-accent-red)';

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        Assurance Account
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-[var(--color-text-secondary)]">Balance</span>
          <span className="text-lg font-bold" data-testid="assurance-balance-display">
            {formatUsdcDisplay(assuranceBalance)}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-xs text-[var(--color-text-secondary)]">Outstanding</span>
          <span className="text-sm" data-testid="assurance-outstanding-display">
            {formatUsdcDisplay(totalOutstanding)}
          </span>
        </div>

        {/* Coverage bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Coverage</span>
            <span
              className="text-xs font-semibold"
              style={{ color: statusColor }}
              data-testid="assurance-coverage-display"
            >
              {coveragePercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-bg-card)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(coveragePercent, 100)}%`,
                backgroundColor: statusColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
