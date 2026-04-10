'use client';

import { useRef, useEffect } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type CoverageData = { balance: number; outstanding: number; coverage: number; _ui: string };

function CoverageCardUI({ data }: GenUIProps<CoverageData>) {
  const assuranceDollars = data.balance / 1_000_000; // base units → USDC
  const outstandingCount = data.outstanding; // all issued specie (user-held + listed) that assurance backs
  const ratio = outstandingCount > 0 ? assuranceDollars / outstandingCount : 0; // per-specie backing rate (should be $1.00)
  const pct = data.coverage;
  const color = pct >= 50 ? 'var(--color-accent-green)' : pct >= 25 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';
  const label = pct >= 50 ? 'Healthy' : pct >= 25 ? 'Warning' : 'Critical';

  const containerRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef<HTMLParagraphElement>(null);
  const prevRatioRef = useRef(0);

  // Entrance animation (once)
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Counter animation — re-runs when ratio changes
  useEffect(() => {
    if (!ratioRef.current) return;
    const from = prevRatioRef.current;
    const to = ratio;
    prevRatioRef.current = ratio;

    const fmt = (v: number) => {
      const w = Math.floor(v).toLocaleString('en-US');
      const c = (v % 1).toFixed(2).slice(1);
      return '$' + w + '<span class="text-[24px] text-[var(--color-text-secondary)]">' + c + '</span>';
    };

    if (from === to) {
      ratioRef.current.innerHTML = fmt(to);
      return;
    }

    const target = { val: from };
    gsap.to(target, {
      val: to,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (ratioRef.current) {
          ratioRef.current.innerHTML = fmt(target.val);
        }
      },
    });
  }, [ratio]);

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          Buy Back Guarantee
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}33`, color }}
        >
          {label}
        </span>
      </div>

      {/* Hero ratio */}
      <p
        ref={ratioRef}
        className="text-[48px] font-extralight tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
      >
        $0<span className="text-[24px] text-[var(--color-text-secondary)]">.00</span>
      </p>

      {/* Balance lines */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-secondary)]">Assurance Account</span>
          <span className="font-semibold">
            ${assuranceDollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-secondary)]">Circulation</span>
          <span className="font-semibold">
            {outstandingCount.toLocaleString('en-US')} SPECIES
          </span>
        </div>
      </div>
    </div>
  );
}

registerUIComponent('CoverageCard', CoverageCardUI as unknown as React.ComponentType<GenUIProps>);
export { CoverageCardUI };
