'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type LifecycleData = {
  title: string;
  amount: string;
  steps: { label: string; done: boolean }[];
  newBalance?: string;
  _ui: string;
};

function LifecycleCardUI({ data }: GenUIProps<LifecycleData>) {
  const allDone = data.steps.every(s => s.done);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35 });
    tl.from('.lifecycle-step', { x: -8, opacity: 0, duration: 0.2, stagger: 0.06 }, '-=0.1');
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-xs">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{data.title}</p>
        {allDone && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-green)]/20">Done</span>}
      </div>
      <div className="px-5 pb-2">
        <p className="text-xl font-semibold">{data.amount}</p>
      </div>
      <div className="px-5 pb-4 space-y-2">
        {data.steps.map((step, i) => (
          <div key={i} className="lifecycle-step flex items-center gap-2.5">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
              step.done ? 'bg-[var(--color-accent-green)]' : 'border border-[var(--color-border)]'
            }`}>
              {step.done && <svg width="6" height="6" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className={`text-[11px] ${step.done ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{step.label}</span>
          </div>
        ))}
      </div>
      {data.newBalance && (
        <div className="border-t border-[var(--color-border)] px-5 py-2.5 bg-[var(--color-bg-card)]">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">New Balance</span>
            <span className="font-semibold">{data.newBalance}</span>
          </div>
        </div>
      )}
    </div>
  );
}

registerUIComponent('LifecycleCard', LifecycleCardUI as unknown as React.ComponentType<GenUIProps>);
export { LifecycleCardUI };
