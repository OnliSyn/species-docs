'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type TxItem = { type: string; description: string; amount: number; date: string; status: string };
type TxListData = { transactions: TxItem[]; _ui: string };

function TransactionListUI({ data }: GenUIProps<TxListData>) {
  const items = Array.isArray(data.transactions) ? data.transactions : (Array.isArray(data) ? data : []);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
    gsap.from('.tx-row', { y: 8, opacity: 0, duration: 0.2, stagger: 0.05, delay: 0.15, ease: 'power2.out' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] px-4 pt-4 pb-2">
        Recent Transactions
      </p>
      {items.map((tx: TxItem, i: number) => {
        const amt = tx.amount / 1_000_000;
        const pos = amt >= 0;
        return (
          <div key={i} className="tx-row flex items-center px-4 py-2.5 border-t border-[var(--color-border)]">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{tx.description}</p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">{tx.date}</p>
            </div>
            <p className={`text-xs font-semibold ml-3 ${pos ? 'text-[#4CAF50]' : 'text-[var(--color-text-primary)]'}`}>
              {pos ? '+' : ''}{amt.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

registerUIComponent('TransactionList', TransactionListUI as unknown as React.ComponentType<GenUIProps>);
export { TransactionListUI };
