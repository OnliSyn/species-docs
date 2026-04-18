'use client';

import { formatUsdcDisplay } from '@/lib/amount';

interface BalanceCardData {
  vaId: string;
  subtype: string;
  balance: { posted: number; pending: number; available: number };
  currency: string;
  status: string;
}

export function BalanceCard({ data }: { data: BalanceCardData }) {
  const amount = data.balance?.available || data.balance?.posted || 0;
  const formatted = formatUsdcDisplay(BigInt(Math.trunc(amount)));

  const subtypeLabel = data.subtype === 'funding' ? 'Funding Account'
    : data.subtype === 'species' ? 'Species Account'
    : 'Assurance Account';

  const icon = data.subtype === 'funding' ? '\u{1F4B0}' : data.subtype === 'species' ? '\u{1F33F}' : '\u{1F6E1}\uFE0F';

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          {subtypeLabel}
        </span>
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
          data.status === 'active' ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-text-primary)]' : 'bg-[var(--color-accent-amber)]/20'
        }`}>
          {data.status}
        </span>
      </div>
      <p className="text-[28px] font-bold text-[var(--color-text-primary)]">
        {formatted}
      </p>
      {data.balance?.pending > 0 && (
        <p className="text-xs text-[var(--color-accent-amber)] mt-1">
          Pending: {formatUsdcDisplay(BigInt(Math.trunc(data.balance.pending)))}
        </p>
      )}
    </div>
  );
}
