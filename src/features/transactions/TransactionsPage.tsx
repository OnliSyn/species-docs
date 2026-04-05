'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatUsdcDisplay } from '@/lib/amount';

type TransactionType = 'all' | 'deposit' | 'withdrawal' | 'transfer' | 'buy' | 'sell';
type TransactionSystem = 'all' | 'funding' | 'asset';

interface AuditEvent {
  event: string;
  timestamp: string;
  source: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'buy' | 'sell';
  system: 'funding' | 'asset';
  description: string;
  amount: bigint;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  auditTrail: AuditEvent[];
}

const TX_ICONS: Record<Transaction['type'], string> = {
  deposit: '\u2193',
  withdrawal: '\u2191',
  transfer: '\u21C4',
  buy: '\u25B2',
  sell: '\u25BC',
};

function makeAudit(type: Transaction['type'], status: Transaction['status']): AuditEvent[] {
  const base = new Date('2026-04-03T14:00:00Z');
  if (type === 'deposit') {
    const events: AuditEvent[] = [
      { event: 'deposit_detected', timestamp: new Date(base.getTime()).toISOString(), source: 'FundingSB' },
      { event: 'deposit_confirmed', timestamp: new Date(base.getTime() + 120_000).toISOString(), source: 'FundingSB' },
      { event: 'balance_credited', timestamp: new Date(base.getTime() + 180_000).toISOString(), source: 'FundingSB' },
    ];
    if (status === 'completed') events.push({ event: 'tx_finalized', timestamp: new Date(base.getTime() + 240_000).toISOString(), source: 'Oracle' });
    return events;
  }
  if (type === 'withdrawal') {
    return [
      { event: 'withdrawal_requested', timestamp: new Date(base.getTime()).toISOString(), source: 'FundingSB' },
      { event: 'withdrawal_approved', timestamp: new Date(base.getTime() + 60_000).toISOString(), source: 'FundingSB' },
      { event: 'usdc_transferred', timestamp: new Date(base.getTime() + 300_000).toISOString(), source: 'FundingSB' },
      { event: 'tx_finalized', timestamp: new Date(base.getTime() + 360_000).toISOString(), source: 'Oracle' },
    ];
  }
  if (type === 'buy') {
    return [
      { event: 'order_submitted', timestamp: new Date(base.getTime()).toISOString(), source: 'MarketSB' },
      { event: 'funds_reserved', timestamp: new Date(base.getTime() + 30_000).toISOString(), source: 'FundingSB' },
      { event: 'species_minted', timestamp: new Date(base.getTime() + 90_000).toISOString(), source: 'MarketSB' },
      { event: 'settlement_complete', timestamp: new Date(base.getTime() + 150_000).toISOString(), source: 'MarketSB' },
    ];
  }
  if (type === 'sell') {
    return [
      { event: 'sell_order_submitted', timestamp: new Date(base.getTime()).toISOString(), source: 'MarketSB' },
      { event: 'species_locked', timestamp: new Date(base.getTime() + 30_000).toISOString(), source: 'MarketSB' },
      ...(status === 'completed'
        ? [
            { event: 'species_burned', timestamp: new Date(base.getTime() + 90_000).toISOString(), source: 'MarketSB' },
            { event: 'funds_released', timestamp: new Date(base.getTime() + 150_000).toISOString(), source: 'FundingSB' },
          ]
        : []),
    ];
  }
  // transfer
  return [
    { event: 'transfer_initiated', timestamp: new Date(base.getTime()).toISOString(), source: 'FundingSB' },
    { event: 'recipient_verified', timestamp: new Date(base.getTime() + 30_000).toISOString(), source: 'FundingSB' },
    { event: 'transfer_complete', timestamp: new Date(base.getTime() + 90_000).toISOString(), source: 'FundingSB' },
  ];
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'deposit', system: 'funding', description: 'USDC Deposit', amount: 5_000_000_000n, status: 'completed', timestamp: '2026-04-03T14:30:00Z', auditTrail: makeAudit('deposit', 'completed') },
  { id: '2', type: 'buy', system: 'asset', description: 'Buy 1,000 SPECIES', amount: -1_030_000_000n, status: 'completed', timestamp: '2026-04-03T15:00:00Z', auditTrail: makeAudit('buy', 'completed') },
  { id: '3', type: 'transfer', system: 'funding', description: 'Transfer $100 to Pepper Potts', amount: -100_000_000n, status: 'completed', timestamp: '2026-04-03T16:00:00Z', auditTrail: makeAudit('transfer', 'completed') },
  { id: '4', type: 'sell', system: 'asset', description: 'Sell 500 SPECIES', amount: 490_000_000n, status: 'pending', timestamp: '2026-04-04T09:00:00Z', auditTrail: makeAudit('sell', 'pending') },
  { id: '5', type: 'withdrawal', system: 'funding', description: 'USDC Withdrawal', amount: -2_000_000_000n, status: 'completed', timestamp: '2026-04-04T10:30:00Z', auditTrail: makeAudit('withdrawal', 'completed') },
  { id: '6', type: 'buy', system: 'asset', description: 'Buy 2,500 SPECIES', amount: -2_575_000_000n, status: 'completed', timestamp: '2026-04-04T12:00:00Z', auditTrail: makeAudit('buy', 'completed') },
  { id: '7', type: 'transfer', system: 'asset', description: 'Transfer 200 SPECIES to Tony Stark', amount: -200_000_000n, status: 'completed', timestamp: '2026-04-04T14:15:00Z', auditTrail: makeAudit('transfer', 'completed') },
  { id: '8', type: 'deposit', system: 'funding', description: 'USDC Deposit', amount: 10_000_000_000n, status: 'completed', timestamp: '2026-04-05T08:00:00Z', auditTrail: makeAudit('deposit', 'completed') },
  { id: '9', type: 'sell', system: 'asset', description: 'Listing Fee', amount: -100_000_000n, status: 'completed', timestamp: '2026-04-05T09:30:00Z', auditTrail: makeAudit('sell', 'completed') },
  { id: '10', type: 'sell', system: 'asset', description: 'Sell 1,000 SPECIES', amount: 980_000_000n, status: 'failed', timestamp: '2026-04-05T11:00:00Z', auditTrail: makeAudit('sell', 'completed') },
];

function TransactionDetailDrawer({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const isMarketSB = transaction.auditTrail.some((e) => e.source === 'MarketSB');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-[var(--color-border)] shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Transaction Detail</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] transition-colors"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Icon + Description */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                transaction.system === 'funding' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
              )}
            >
              {TX_ICONS[transaction.type]}
            </div>
            <div>
              <p className="text-sm font-semibold capitalize">{transaction.type}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{transaction.description}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Amount</p>
            <p
              className={cn(
                'text-2xl font-bold',
                transaction.amount >= 0n ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-primary)]',
              )}
            >
              {transaction.amount >= 0n ? '+' : ''}
              {formatUsdcDisplay(transaction.amount)}
            </p>
          </div>

          {/* Status */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Status</p>
            <span
              className={cn(
                'inline-block text-xs font-semibold px-3 py-1 rounded-full capitalize',
                transaction.status === 'completed' && 'bg-[#C5DE8A]/30 text-[#3d6b00]',
                transaction.status === 'pending' && 'bg-[#FFCE73]/30 text-[#8a6d00]',
                transaction.status === 'failed' && 'bg-[#E74C3C]/20 text-[#E74C3C]',
              )}
            >
              {transaction.status}
            </span>
          </div>

          {/* Timestamp */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Timestamp</p>
            <p className="text-sm">{new Date(transaction.timestamp).toLocaleString()}</p>
          </div>

          {/* System */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">System</p>
            <span
              className={cn(
                'inline-block text-xs font-semibold px-3 py-1 rounded-full capitalize',
                transaction.system === 'funding' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
              )}
            >
              {transaction.system === 'funding' ? 'Funding (FundingSB)' : 'Asset (MarketSB)'}
            </span>
          </div>

          {/* Oracle Audit Trail */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">Oracle Audit Trail</p>
            <div className="relative pl-4 border-l-2 border-[var(--color-border)] space-y-3">
              {transaction.auditTrail.map((evt, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-cta-primary)]" />
                  <p className="text-sm font-mono font-medium">{evt.event}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {new Date(evt.timestamp).toLocaleTimeString()} &middot; {evt.source}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Verify button for MarketSB transactions */}
          {isMarketSB && (
            <button
              onClick={() => {
                console.log('Verifying audit chain for transaction:', transaction.id);
              }}
              className="w-full py-2.5 px-4 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Verify Audit Chain
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionType>('all');
  const [systemFilter, setSystemFilter] = useState<TransactionSystem>('all');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const filtered = MOCK_TRANSACTIONS.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (systemFilter !== 'all' && tx.system !== systemFilter) return false;
    return true;
  });

  const selectedTransaction = selectedTransactionId
    ? MOCK_TRANSACTIONS.find((tx) => tx.id === selectedTransactionId) ?? null
    : null;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Transactions</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)]">
          {(['all', 'deposit', 'withdrawal', 'transfer', 'buy', 'sell'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-[var(--radius-input)] capitalize',
                typeFilter === t ? 'bg-white shadow-sm' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)]">
          {(['all', 'funding', 'asset'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSystemFilter(s)}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-[var(--radius-input)] capitalize',
                systemFilter === s ? 'bg-white shadow-sm' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {filtered.map((tx) => (
          <div
            key={tx.id}
            onClick={() => setSelectedTransactionId(tx.id)}
            className="flex items-center gap-4 p-4 rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] shadow-[var(--shadow-card)] hover:bg-[var(--color-bg-card)] transition-colors cursor-pointer"
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                tx.system === 'funding' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700',
              )}
            >
              {TX_ICONS[tx.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{tx.description}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{new Date(tx.timestamp).toLocaleString()}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={cn(
                  'text-sm font-bold',
                  tx.amount >= 0n ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-text-primary)]',
                )}
              >
                {tx.amount >= 0n ? '+' : ''}
                {formatUsdcDisplay(tx.amount)}
              </p>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full capitalize',
                  tx.status === 'completed' && 'bg-[#C5DE8A]/20 text-[var(--color-text-primary)]',
                  tx.status === 'pending' && 'bg-[#FFCE73]/20 text-[var(--color-text-primary)]',
                  tx.status === 'failed' && 'bg-[#E74C3C]/20 text-[#E74C3C]',
                )}
              >
                {tx.status}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">No transactions match your filters.</div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedTransaction && (
        <TransactionDetailDrawer transaction={selectedTransaction} onClose={() => setSelectedTransactionId(null)} />
      )}
    </div>
  );
}
