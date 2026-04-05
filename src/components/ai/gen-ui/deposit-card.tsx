'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type DepositData = {
  depositId: string;
  amount: number;
  status: string;
  lifecycle: { state: string; timestamp: string }[];
  txHash?: string;
  _ui: string;
};

function DepositCardUI({ data }: GenUIProps<DepositData>) {
  const amt = (data.amount / 1_000_000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const steps = ['detected', 'compliance_pending', 'compliance_passed', 'credited', 'registered'];
  const currentIdx = steps.indexOf(data.status);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35 });
    tl.from('.deposit-step', { x: -8, opacity: 0, duration: 0.2, stagger: 0.06 }, '-=0.1');
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Deposit</p>
        <p className="text-[10px] font-mono text-[var(--color-text-secondary)]">{data.depositId}</p>
      </div>
      <p className="text-xl font-semibold mb-4">{amt}</p>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step} className="deposit-step flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
              i <= currentIdx
                ? 'bg-[var(--color-accent-green)]'
                : 'border border-[var(--color-border)]'
            }`}>
              {i <= currentIdx && (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={`text-[11px] ${i <= currentIdx ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
              {step.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
      {data.txHash && (
        <p className="text-[9px] font-mono text-[var(--color-text-secondary)] mt-3 truncate">
          {data.txHash}
        </p>
      )}
    </div>
  );
}

registerUIComponent('DepositCard', DepositCardUI as unknown as React.ComponentType<GenUIProps>);
export { DepositCardUI };
