'use client';

interface ConfirmLine {
  label: string;
  value: string;
  bold?: boolean;
}

interface JourneyConfirmCardProps {
  title: string;           // "BUY 1,000 SPECIES" or "FUND YOUR ACCOUNT"
  lines: ConfirmLine[];
  warning?: string;        // e.g., "THIS WITHDRAWAL IS IRREVERSIBLE"
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function JourneyConfirmCard({ title, lines, warning, onConfirm, onCancel, disabled }: JourneyConfirmCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        {title}
      </h4>

      <div className="space-y-1.5 mb-4">
        {lines.map((line, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">{line.label}</span>
            <span className={line.bold ? 'font-bold' : 'font-medium'}>{line.value}</span>
          </div>
        ))}
      </div>

      {warning && (
        <div className="mb-4 px-3 py-2 rounded-[var(--radius-input)] bg-[var(--color-accent-red)]/10 text-xs text-[var(--color-accent-red)] font-medium">
          {warning}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 py-2 rounded-[var(--radius-button)] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-bg-sidebar)] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
