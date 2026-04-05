'use client';

interface VaultData {
  userId: string;
  count: number;
}

export function VaultCard({ data }: { data: VaultData }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{'\u{1F3E6}'}</span>
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Onli Vault
        </h4>
      </div>
      <p className="text-[28px] font-bold text-[var(--color-text-primary)]">
        {(data.count || 0).toLocaleString()} <span className="text-sm font-normal text-[var(--color-text-secondary)]">SPECIES</span>
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
        ≈ ${(data.count || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
      </p>
    </div>
  );
}
