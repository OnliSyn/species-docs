'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type ReceiptData = {
  type: 'fund' | 'buy' | 'sell' | 'transfer' | 'sendout';
  title: string;
  lines: { label: string; value: string; bold?: boolean }[];
  eventId?: string;
  batchId?: string;
  oracle?: string;
  timestamp?: string;
  balances?: { funding: string; species: string };
  _ui: string;
};

function ReceiptCardUI({ data }: GenUIProps<ReceiptData>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { scale: 0.95, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-accent-green)] bg-white overflow-hidden my-2 shadow-sm max-w-xs">
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[var(--color-accent-green)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent-green)]">
          {data.title}
        </p>
      </div>

      <div className="px-5 pb-3 space-y-1.5">
        {data.lines.map((line, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">{line.label}</span>
            <span className={line.bold ? 'font-bold' : 'font-medium'}>{line.value}</span>
          </div>
        ))}
      </div>

      {data.oracle && (
        <div className="px-5 pb-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-accent-green)]">&#10003;</span> Oracle: {data.oracle}
        </div>
      )}

      {(data.eventId || data.batchId) && (
        <div className="border-t border-[var(--color-border)] px-5 py-2 text-[9px] font-mono text-[var(--color-text-secondary)]">
          {data.eventId && <span>evt: {data.eventId}</span>}
          {data.batchId && <span className="ml-3">batch: {data.batchId}</span>}
        </div>
      )}

      {data.balances && (
        <div className="border-t border-[var(--color-border)] px-5 py-2.5 bg-[var(--color-bg-card)]">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">Funding</span>
            <span className="font-semibold">{data.balances.funding}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-[var(--color-text-secondary)]">Species</span>
            <span className="font-semibold">{data.balances.species}</span>
          </div>
        </div>
      )}

      {data.timestamp && (
        <div className="border-t border-[var(--color-border)] px-5 py-1.5 text-right">
          <span className="text-[9px] text-[var(--color-text-secondary)]">{data.timestamp}</span>
        </div>
      )}
    </div>
  );
}

registerUIComponent('ReceiptCard', ReceiptCardUI as unknown as React.ComponentType<GenUIProps>);
export { ReceiptCardUI };
