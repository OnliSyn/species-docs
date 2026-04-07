'use client';

import { useRef, useState, useEffect } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type PipelineStage = { label: string; system: string; status: 'done' | 'active' | 'pending' };
type PipelineData = {
  title: string;
  eventId: string;
  batchId?: string;
  stages: PipelineStage[];
  receipt?: {
    quantity: number;
    cost: string;
    fees: string;
    total: string;
    assurance?: string;
    note?: string;
  };
  balances?: {
    funding: string;
    species: string;
  };
  _ui: string;
};

const SYSTEM_COLORS: Record<string, string> = {
  SM: '#6B6B6B',
  MB: '#2775CA',
  OC: '#16A34A',
};

// Stage delay in ms — varies by system to feel realistic
const STAGE_DELAYS: Record<string, number> = {
  SM: 250,
  MB: 400,
  OC: 350,
};

function PipelineCardUI({ data }: GenUIProps<PipelineData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [completedIdx, setCompletedIdx] = useState(-1);
  const animatingRef = useRef(false);

  // Animate stages from pending → active → done one at a time
  useEffect(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const allDone = data.stages.every(s => s.status === 'done');
    if (!allDone) {
      // If stages aren't all done, show as-is
      setCompletedIdx(data.stages.length - 1);
      return;
    }

    // Animate each stage sequentially
    let i = 0;
    const advance = () => {
      if (i >= data.stages.length) return;
      setCompletedIdx(i);
      i++;
      if (i < data.stages.length) {
        const sys = data.stages[i - 1]?.system || 'SM';
        setTimeout(advance, STAGE_DELAYS[sys] || 300);
      }
    };
    // Start after card entrance animation (300ms)
    setTimeout(advance, 350);
  }, [data.stages]);

  const isAllComplete = completedIdx >= data.stages.length - 1;

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(containerRef.current, { y: 20, opacity: 0, duration: 0.3 });
    tl.from('.pipeline-stage', {
      x: -10,
      opacity: 0,
      duration: 0.2,
      stagger: 0.04,
    }, '-=0.1');
  }, { scope: containerRef });

  // Animate receipt in when all stages complete
  useEffect(() => {
    if (isAllComplete && containerRef.current) {
      const receipt = containerRef.current.querySelector('.pipeline-receipt');
      if (receipt) {
        gsap.from(receipt, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' });
      }
    }
  }, [isAllComplete]);

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-sm">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
          {data.title}
        </p>
        {isAllComplete ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-green)]/20 text-[var(--color-text-primary)]">
            Complete
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            Processing
          </span>
        )}
      </div>

      {/* Onli You authorization */}
      <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-[#D4F5A0]/20 border border-[#D4F5A0]/40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-primary)]">Authorized via Onli You</span>
      </div>

      {/* Pipeline stages */}
      <div className="px-5 pb-4">
        <div className="space-y-1">
          {data.stages.map((stage, i) => {
            const isDone = i <= completedIdx;
            const isActive = i === completedIdx + 1;
            return (
              <div key={i} className="pipeline-stage flex items-center gap-2.5 py-0.5">
                {/* Connector line + dot */}
                <div className="flex flex-col items-center w-4">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDone ? 'bg-[var(--color-accent-green)]'
                    : isActive ? 'bg-[var(--color-cta-primary)] animate-pulse'
                    : 'border border-[var(--color-border)] bg-white'
                  }`}>
                    {isDone && (
                      <svg className="pipeline-check" width="6" height="6" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                {/* Label + system */}
                <span className={`text-[11px] flex-1 transition-colors duration-200 ${
                  isDone ? 'text-[var(--color-text-primary)]'
                  : isActive ? 'text-[var(--color-text-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)]'
                }`}>
                  {stage.label}
                  {isActive && <span className="text-[9px] text-[var(--color-text-secondary)] ml-1">...</span>}
                </span>
                <span className="text-[9px] font-mono" style={{ color: isDone || isActive ? (SYSTEM_COLORS[stage.system] || '#6B6B6B') : '#D1D5DB' }}>
                  {stage.system}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Receipt (if order complete) */}
      {isAllComplete && data.receipt && (
        <div className="pipeline-receipt border-t border-[var(--color-border)] px-5 py-3 bg-[var(--color-bg-card)]">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Quantity</span>
              <span className="font-medium">{data.receipt.quantity.toLocaleString()} SPECIES</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Cost</span>
              <span>{data.receipt.cost}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Fees</span>
              <span>{data.receipt.fees}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-[var(--color-border)]">
              <span>Total</span>
              <span>{data.receipt.total}</span>
            </div>
            {data.receipt.note && (
              <p className="text-[9px] text-[var(--color-text-secondary)] pt-1">{data.receipt.note}</p>
            )}
          </div>
        </div>
      )}

      {/* IDs */}
      {(data.eventId || data.batchId) && (
        <div className="border-t border-[var(--color-border)] px-5 py-2 flex gap-4">
          {data.eventId && <p className="text-[9px] font-mono text-[var(--color-text-secondary)] truncate">evt: {data.eventId}</p>}
          {data.batchId && <p className="text-[9px] font-mono text-[var(--color-text-secondary)] truncate">batch: {data.batchId}</p>}
        </div>
      )}

      {/* Updated balances */}
      {isAllComplete && data.balances && (
        <div className="pipeline-receipt border-t border-[var(--color-border)] px-5 py-3 bg-[var(--color-bg-card)]">
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
    </div>
  );
}

registerUIComponent('PipelineCard', PipelineCardUI as unknown as React.ComponentType<GenUIProps>);
export { PipelineCardUI };
