'use client';

interface AssuranceData {
  balance: number;
  outstanding: number;
  coverage: number;
}

export function AssuranceCoverageCard({ data }: { data: AssuranceData }) {
  const balance = (data.balance / 1_000_000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const outstanding = (data.outstanding / 1_000_000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const coverage = data.coverage || (data.outstanding > 0 ? Math.round((data.balance / data.outstanding) * 100) : 100);

  const color = coverage >= 50 ? 'var(--color-accent-green)' : coverage >= 25 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';
  const label = coverage >= 50 ? 'Healthy' : coverage >= 25 ? 'Warning' : 'Critical';

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
          <span className="text-[var(--color-text-secondary)]">Balance</span>
          <span className="font-bold">{balance}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Outstanding</span>
          <span>{outstanding}</span>
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-secondary)]">Coverage</span>
          <span className="text-xs font-bold" style={{ color }}>{coverage}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-bg-card)]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(coverage, 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
