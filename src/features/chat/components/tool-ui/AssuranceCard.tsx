'use client';

import type { AssuranceCoverageSnapshot } from '@/lib/sim-client';
import { normalizeAssuranceCoveragePayload } from '@/lib/normalize-assurance-coverage';

export type AssuranceToolData = AssuranceCoverageSnapshot & { _ui?: string };

export function AssuranceCoverageCard({ data }: { data: AssuranceToolData }) {
  const snap = normalizeAssuranceCoveragePayload(data);
  const {
    circulationSpecieCount,
    coveragePercent,
    assurancePostedDisplay,
    circulationValuePostedDisplay,
  } = snap;

  const circulationIdle = circulationSpecieCount <= 0;
  let label: string;
  let color: string;
  if (circulationIdle) {
    label = 'Idle';
    color = 'var(--color-text-secondary)';
  } else if (coveragePercent > 100) {
    label = 'Surplus';
    color = 'var(--color-accent-amber)';
  } else if (coveragePercent < 100) {
    label = coveragePercent >= 50 ? 'Warning' : 'Critical';
    color = coveragePercent >= 50 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';
  } else {
    label = 'Healthy';
    color = 'var(--color-accent-green)';
  }

  const barWidthPct = Math.min(Math.max(coveragePercent, 0), 100);

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Assurance Coverage
        </h4>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${color}33`, color }}>
          {label}
        </span>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Assurance</span>
          <span className="font-bold">{assurancePostedDisplay}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Circulation value</span>
          <span>{circulationValuePostedDisplay}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Circulation</span>
          <span className="font-mono">{circulationSpecieCount.toLocaleString()} SPECIES</span>
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-secondary)]">Coverage</span>
          <span className="text-xs font-bold" style={{ color }}>{coveragePercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-bg-card)]">
          <div className="h-full rounded-full" style={{ width: `${barWidthPct}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
