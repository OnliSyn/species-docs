'use client';

import { useState, useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap-config';

const PIPELINE_STAGES = [
  { label: 'Submit Order', system: 'SM', desc: 'EventRequest submitted to Species Marketplace' },
  { label: 'Authenticate', system: 'SM', desc: 'Verify identity via Onli You' },
  { label: 'Validate', system: 'SM', desc: 'Check order params, pricing, and availability' },
  { label: 'Match', system: 'SM', desc: 'Find seller listing or draw from Treasury' },
  { label: 'Stage Asset', system: 'OC', desc: 'Onli Cloud prepares Genome for transfer' },
  { label: 'Process Payment', system: 'MB', desc: 'MarketSB Cashier settles USDC via TigerBeetle' },
  { label: 'Deliver to Vault', system: 'OC', desc: 'ChangeOwner moves asset to buyer\'s Vault' },
  { label: 'Oracle Verify', system: 'OC', desc: 'Oracle confirms possession and logs audit trail' },
  { label: 'Complete', system: 'SM', desc: 'Order finalized, balances updated' },
];

const SYSTEM_COLORS: Record<string, string> = {
  SM: '#6B6B6B',
  MB: '#2775CA',
  OC: '#16A34A',
};

const SYSTEM_LABELS: Record<string, string> = {
  SM: 'Species Marketplace',
  MB: 'MarketSB Cashier',
  OC: 'Onli Cloud',
};

interface PipelineWalkthroughProps {
  onSwitchToTrade: () => void;
}

export function PipelineWalkthrough({ onSwitchToTrade }: PipelineWalkthroughProps) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i >= PIPELINE_STAGES.length) {
        clearInterval(timer);
        setDone(true);
        return;
      }
      setActiveIdx(i);
      i++;
    }, 800);

    return () => clearInterval(timer);
  }, []);

  // Animate the CTA when done
  useEffect(() => {
    if (done && containerRef.current) {
      const cta = containerRef.current.querySelector('.pipeline-cta');
      if (cta) {
        gsap.from(cta, { y: 10, opacity: 0, duration: 0.4, ease: 'power2.out' });
      }
    }
  }, [done]);

  return (
    <div ref={containerRef} className="w-full max-w-sm mx-auto">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)] mb-4">
        Buy Journey — 9-Stage Pipeline
      </p>

      <div className="space-y-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          const isPending = i > activeIdx;

          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-3 py-2 transition-opacity duration-300',
                isPending && activeIdx >= 0 ? 'opacity-30' : 'opacity-100',
              )}
            >
              {/* Connector */}
              <div className="flex flex-col items-center w-5 pt-0.5">
                <div className={cn(
                  'w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-500',
                  isDone && 'bg-[var(--color-accent-green)]',
                  isActive && 'bg-[var(--color-cta-primary)] animate-pulse',
                  isPending && 'border border-[var(--color-border)] bg-white',
                )}>
                  {isDone && (
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className={cn(
                    'w-px h-4 mt-0.5 transition-colors duration-500',
                    isDone ? 'bg-[var(--color-accent-green)]' : 'bg-[var(--color-border)]',
                  )} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[13px] transition-colors duration-300',
                    isDone || isActive ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]',
                  )}>
                    {stage.label}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{
                    color: isDone || isActive ? SYSTEM_COLORS[stage.system] : '#D1D5DB',
                    backgroundColor: isDone || isActive ? `${SYSTEM_COLORS[stage.system]}10` : 'transparent',
                  }}>
                    {stage.system}
                  </span>
                </div>
                {(isDone || isActive) && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    {stage.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="pipeline-cta mt-6 text-center space-y-3">
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Ready to try it? Switch to Trade mode to execute a real journey.
          </p>
          <button
            onClick={onSwitchToTrade}
            className="px-5 py-2.5 rounded-full bg-[var(--color-cta-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Switch to Trade
          </button>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
