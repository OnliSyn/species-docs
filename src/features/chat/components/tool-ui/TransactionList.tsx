'use client';

interface Transaction {
  type: string;
  description: string;
  amount: number;
  date: string;
  status: string;
}

export function TransactionList({ data }: { data: Transaction[] }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2 overflow-x-auto">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        Recent Transactions
      </h4>
      <div className="space-y-2">
        {(Array.isArray(data) ? data : []).map((tx, i) => {
          const amount = tx.amount / 1_000_000;
          const isPositive = amount >= 0;
          return (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0">
              <span className="text-sm">{tx.type === 'deposit' ? '\u2193' : tx.type === 'buy' ? '\u{1F33F}' : tx.type === 'sell' ? '\u{1F4E4}' : tx.type === 'transfer' ? '\u2194' : '\u2191'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{tx.description}</p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{tx.date}</p>
              </div>
              <span className={`text-xs font-bold ${isPositive ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-primary)]'}`}>
                {isPositive ? '+' : ''}{amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                tx.status === 'completed' ? 'bg-[var(--color-accent-green)]/20'
                : tx.status === 'pending' ? 'bg-[var(--color-accent-amber)]/20'
                : 'bg-[var(--color-accent-red)]/20'
              }`}>{tx.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
