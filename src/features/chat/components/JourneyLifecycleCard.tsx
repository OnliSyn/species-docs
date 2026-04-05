'use client';

import { cn } from '@/lib/utils';

export interface LifecycleStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

interface JourneyLifecycleCardProps {
  title: string;       // "FUND YOUR ACCOUNT" or "WITHDRAW $2,000.00"
  steps: LifecycleStep[];
  info?: string;       // e.g., deposit address, tx hash
  error?: string | null;
}

export function JourneyLifecycleCard({ title, steps, info, error }: JourneyLifecycleCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        {title}
      </h4>

      {info && (
        <div className="mb-3 px-3 py-2 rounded-[var(--radius-input)] bg-[var(--color-bg-card)] font-mono text-[10px] break-all">
          {info}
        </div>
      )}

      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
              step.status === 'done' && 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]',
              step.status === 'active' && 'bg-[var(--color-cta-primary)] text-white animate-pulse',
              step.status === 'error' && 'bg-[var(--color-accent-red)] text-white',
              step.status === 'pending' && 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
            )}>
              {step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : ''}
            </div>
            <span className={cn(
              'text-xs',
              step.status === 'done' || step.status === 'active' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-[var(--radius-input)] bg-[var(--color-accent-red)]/10 text-xs text-[var(--color-accent-red)]">
          {error}
        </div>
      )}
    </div>
  );
}
