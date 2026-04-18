'use client';

import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';
import { postedBaseUnitsToUsdNumber } from '@/lib/amount';

// Funding oracle entry shape (from MarketSB)
type FundingEntry = {
  entryId: string;
  type: string;
  amount: number;
  ref: string;
  timestamp: string;
};

// Asset oracle entry shape (from Species sim)
type AssetEntry = {
  id: string;
  eventId: string;
  type: string;
  from: string;
  to: string;
  count: number;
  timestamp: string;
};

type TxListData = {
  // New shape: separate ledgers
  funding?: FundingEntry[];
  asset?: AssetEntry[];
  // Legacy shape: flat array
  transactions?: unknown[];
  _ui: string;
};

// Human-readable labels for funding oracle types
const FUNDING_LABELS: Record<string, string> = {
  deposit_credited: 'Deposit',
  withdrawal_debited: 'Withdrawal',
  batch_buy_cost: 'Buy (cost)',
  batch_issuance_fee: 'Issuance fee',
  batch_liquidity_fee: 'Liquidity fee',
  cashier_buy_debit: 'Buy order',
  cashier_species_credit: 'Species credit',
  cashier_assurance_posting: 'Assurance',
  cashier_sell_credit: 'Sell proceeds',
  cashier_sell_debit: 'Sell (buyer)',
  issuance_buy: 'Issuance',
};

// Human-readable labels for asset oracle types
const ASSET_LABELS: Record<string, string> = {
  change_owner: 'Transfer',
  listing_escrow: 'Listed (escrow)',
  listing_release: 'Listing released',
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return ts.slice(0, 10);
  }
}

function TransactionListUI({ data }: GenUIProps<TxListData>) {
  const [tab, setTab] = useState<'funding' | 'asset'>('funding');
  const containerRef = useRef<HTMLDivElement>(null);

  const fundingItems = data.funding ?? [];
  const assetItems = data.asset ?? [];

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm">
      {/* Header + Tab Toggle */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          Oracle
        </p>
        <div className="flex gap-0.5 p-0.5 bg-[var(--color-bg-card)] rounded-md">
          <button
            onClick={() => setTab('funding')}
            className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${
              tab === 'funding'
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Funding
          </button>
          <button
            onClick={() => setTab('asset')}
            className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${
              tab === 'asset'
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Asset
          </button>
        </div>
      </div>

      {/* Funding Tab */}
      {tab === 'funding' && (
        <div>
          {fundingItems.length === 0 ? (
            <p className="px-4 py-4 text-[10px] text-[var(--color-text-secondary)] text-center">No funding transactions</p>
          ) : (
            fundingItems.map((tx: FundingEntry, i: number) => {
              const amt = postedBaseUnitsToUsdNumber(tx.amount ?? 0);
              const label = FUNDING_LABELS[tx.type] ?? tx.type;
              const isCredit = tx.type.includes('credit') || tx.type.includes('deposit');
              return (
                <div key={tx.entryId ?? i} className="tx-row flex items-center px-4 py-2 border-t border-[var(--color-border)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">{label}</p>
                    <p className="text-[9px] text-[var(--color-text-secondary)]">{formatTime(tx.timestamp)}</p>
                  </div>
                  <p className={`text-[11px] font-semibold tabular-nums ml-3 ${isCredit ? 'text-[#4CAF50]' : 'text-[var(--color-text-primary)]'}`}>
                    {isCredit ? '+' : '-'}${Math.abs(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Asset Tab */}
      {tab === 'asset' && (
        <div>
          {assetItems.length === 0 ? (
            <p className="px-4 py-4 text-[10px] text-[var(--color-text-secondary)] text-center">No asset transactions</p>
          ) : (
            assetItems.map((tx: AssetEntry, i: number) => {
              const label = ASSET_LABELS[tx.type] ?? tx.type;
              const isIncoming = tx.to === 'onli-user-001'; // current user
              const counterparty = isIncoming ? tx.from : tx.to;
              const shortParty = counterparty === 'treasury' ? 'Treasury'
                : counterparty === 'settlement' ? 'Settlement'
                : counterparty.replace('onli-', '').slice(0, 12);
              return (
                <div key={tx.id ?? i} className="tx-row flex items-center px-4 py-2 border-t border-[var(--color-border)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
                      {label} {isIncoming ? 'from' : 'to'} {shortParty}
                    </p>
                    <p className="text-[9px] text-[var(--color-text-secondary)]">{formatTime(tx.timestamp)}</p>
                  </div>
                  <p className={`text-[11px] font-semibold tabular-nums ml-3 ${isIncoming ? 'text-[#4CAF50]' : 'text-[var(--color-text-primary)]'}`}>
                    {isIncoming ? '+' : '-'}{tx.count.toLocaleString()} SP
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

registerUIComponent('TransactionList', TransactionListUI as unknown as React.ComponentType<GenUIProps>);
export { TransactionListUI };
