'use client';

import { formatSpecieCount, formatUsdcDisplay, specieToBaseUnits } from '@/lib/amount';

interface CirculationCardProps {
  totalCirculation?: number;
}

export function CirculationCard({ totalCirculation = 1_000_000 }: CirculationCardProps) {
  const usdcValue = specieToBaseUnits(totalCirculation);

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        Circulation
      </h3>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">
        {formatSpecieCount(totalCirculation)}
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
        {'\u2248'} {formatUsdcDisplay(usdcValue)}
      </p>
    </div>
  );
}
