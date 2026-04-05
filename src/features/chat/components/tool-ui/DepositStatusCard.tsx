'use client';

interface DepositData {
  depositId: string;
  amount: number;
  status: string;
  lifecycle: { state: string; timestamp: string }[];
  txHash?: string;
}

export function DepositStatusCard({ data }: { data: DepositData }) {
  const amount = (data.amount / 1_000_000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const steps = ['detected', 'compliance_pending', 'compliance_passed', 'credited', 'registered'];
  const currentIdx = steps.indexOf(data.status);

  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Deposit Status
        </h4>
        <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">{data.depositId}</span>
      </div>
      <p className="text-lg font-bold mb-3">{amount}</p>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
              i <= currentIdx ? 'bg-[var(--color-accent-green)] text-[var(--color-text-primary)]'
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
            }`}>
              {i <= currentIdx ? '\u2713' : ''}
            </div>
            <span className={`text-[10px] ${i <= currentIdx ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
              {step.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
      {data.txHash && (
        <p className="text-[9px] font-mono text-[var(--color-text-secondary)] mt-2 truncate">
          tx: {data.txHash}
        </p>
      )}
    </div>
  );
}
