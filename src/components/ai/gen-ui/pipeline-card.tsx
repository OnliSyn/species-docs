'use client';

import { useRef } from 'react';
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

function PipelineCardUI({ data }: GenUIProps<PipelineData>) {
  const allDone = data.stages.every(s => s.status === 'done');
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    // Card entrance
    tl.from(containerRef.current, { y: 20, opacity: 0, duration: 0.3 });

    // Stagger each stage row
    tl.from('.pipeline-stage', {
      x: -10,
      opacity: 0,
      duration: 0.2,
      stagger: 0.08,
    }, '-=0.1');

    // Checkmarks scale in
    tl.from('.pipeline-check', {
      scale: 0,
      duration: 0.15,
      stagger: 0.06,
      ease: 'back.out(2)',
    }, '-=0.5');

    // Receipt section slides up
    if (containerRef.current?.querySelector('.pipeline-receipt')) {
      tl.from('.pipeline-receipt', {
        y: 10,
        opacity: 0,
        duration: 0.25,
      });
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-sm">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
          {data.title}
        </p>
        {allDone && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-green)]/20 text-[var(--color-text-primary)]">
            Complete
          </span>
        )}
      </div>

      {/* Pipeline stages */}
      <div className="px-5 pb-4">
        <div className="space-y-1">
          {data.stages.map((stage, i) => (
            <div key={i} className="pipeline-stage flex items-center gap-2.5 py-0.5">
              {/* Connector line + dot */}
              <div className="flex flex-col items-center w-4">
                <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                  stage.status === 'done' ? 'bg-[var(--color-accent-green)]'
                  : stage.status === 'active' ? 'bg-[var(--color-cta-primary)]'
                  : 'border border-[var(--color-border)] bg-white'
                }`}>
                  {stage.status === 'done' && (
                    <svg className="pipeline-check" width="6" height="6" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              {/* Label + system */}
              <span className={`text-[11px] flex-1 ${
                stage.status === 'done' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
              }`}>
                {stage.label}
              </span>
              <span className="text-[9px] font-mono" style={{ color: SYSTEM_COLORS[stage.system] || '#6B6B6B' }}>
                {stage.system}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Receipt (if order complete) */}
      {allDone && data.receipt && (
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
      {allDone && data.balances && (
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
