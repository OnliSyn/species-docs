'use client';

import { cn } from '@/lib/utils';

interface ConfirmationCardProps {
  title: string;
  lines: { label: string; value: string }[];
  system: 'funding' | 'asset';
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed';
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmationCard({ title, lines, system, status, onConfirm, onCancel }: ConfirmationCardProps) {
  return (
    <div className={cn(
      'rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)]',
      system === 'funding' ? 'border-blue-200 bg-blue-50/50' : 'border-green-200 bg-green-50/50'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg-card)]">
          {system === 'funding' ? 'Funding' : 'Asset'}
        </span>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>

      <div className="space-y-1.5 mb-4">
        {lines.map((line, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">{line.label}</span>
            <span className="font-medium">{line.value}</span>
          </div>
        ))}
      </div>

      {status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold hover:opacity-90"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm font-semibold hover:bg-[var(--color-bg-sidebar)]"
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'confirmed' && (
        <div className="text-center py-2 text-xs text-[var(--color-accent-green)] font-semibold">Processing...</div>
      )}
      {status === 'executed' && (
        <div className="text-center py-2 text-xs text-[var(--color-accent-green)] font-semibold">{'\u2713'} Executed</div>
      )}
      {status === 'cancelled' && (
        <div className="text-center py-2 text-xs text-[var(--color-text-secondary)] font-semibold">Cancelled</div>
      )}
    </div>
  );
}
