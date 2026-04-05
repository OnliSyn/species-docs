'use client';

import { useRef, useState, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [completedIdx, setCompletedIdx] = useState(-1);
  const animatingRef = useRef(false);

  // Animate steps from pending → done one at a time
  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const allDone = data.steps.every(s => s.done);
    if (!allDone) {
      setCompletedIdx(data.steps.length - 1);
      return;
    }

    let i = 0;
    const advance = () => {
      if (i >= data.steps.length) return;
      setCompletedIdx(i);
      i++;
      if (i < data.steps.length) {
        setTimeout(advance, 350);
      }
    };
    setTimeout(advance, 350);
  }, [data.steps]);

  const isAllComplete = completedIdx >= data.steps.length - 1;

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35 });
    tl.from('.lifecycle-step', { x: -8, opacity: 0, duration: 0.2, stagger: 0.04 }, '-=0.1');
  }, { scope: containerRef });

  // Animate balance in when complete
  useEffect(() => {
    if (isAllComplete && containerRef.current) {
      const bal = containerRef.current.querySelector('.lifecycle-balance');
      if (bal) {
        gsap.from(bal, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' });
      }
    }
  }, [isAllComplete]);

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-xs">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{data.title}</p>
        {isAllComplete ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-green)]/20">Done</span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Processing</span>
        )}
      </div>
      <div className="px-5 pb-2">
        <p className="text-xl font-semibold">{data.amount}</p>
      </div>
      <div className="px-5 pb-4 space-y-2">
        {data.steps.map((step, i) => {
          const isDone = i <= completedIdx;
          const isActive = i === completedIdx + 1;
          return (
            <div key={i} className="lifecycle-step flex items-center gap-2.5">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 ${
                isDone ? 'bg-[var(--color-accent-green)]'
                : isActive ? 'bg-[var(--color-cta-primary)] animate-pulse'
                : 'border border-[var(--color-border)]'
              }`}>
                {isDone && <svg width="6" height="6" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={`text-[11px] transition-colors duration-200 ${
                isDone ? 'text-[var(--color-text-primary)]'
                : isActive ? 'text-[var(--color-text-primary)] font-medium'
                : 'text-[var(--color-text-secondary)]'
              }`}>
                {step.label}
                {isActive && <span className="text-[9px] text-[var(--color-text-secondary)] ml-1">...</span>}
              </span>
            </div>
          );
        })}
      </div>
      {isAllComplete && data.newBalance && (
        <div className="lifecycle-balance border-t border-[var(--color-border)] px-5 py-2.5 bg-[var(--color-bg-card)]">
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
