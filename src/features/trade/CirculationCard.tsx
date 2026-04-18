'use client';

import { formatSpecieCount } from '@/lib/amount';

interface CirculationCardProps {
  totalCirculation: number;
  /** From GET /api/trade-panel — server-formatted peg value, no client money math. */
  circulationValuePostedDisplay: string;
}

export function CirculationCard({ totalCirculation, circulationValuePostedDisplay }: CirculationCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        Circulation
      </h3>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">
        {formatSpecieCount(totalCirculation)}
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
        {'\u2248'} {circulationValuePostedDisplay}
      </p>
    </div>
  );
}
