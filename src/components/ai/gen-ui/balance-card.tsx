'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type BalanceData = {
  label: string;
  amount?: number;
  balance?: { posted: number; pending: number; available: number };
  currency: string;
  status: string;
  specieCount?: number;
  variant?: 'light' | 'dark';
  _ui: string;
};

function BalanceCardUI({ data }: GenUIProps<BalanceData>) {
  // Support both flat `amount` and nested `balance.posted` shapes
  const rawAmount = data.amount ?? data.balance?.posted ?? 0;
  const dollars = rawAmount / 1_000_000;

  const isDark = data.variant === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLParagraphElement>(null);
  const prevDollarsRef = useRef(0);

  // Entrance animation (once)
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Counter animation — re-runs whenever dollars changes
  useEffect(() => {
    if (!amountRef.current) return;
    const from = prevDollarsRef.current;
    const to = dollars;
    prevDollarsRef.current = dollars;

    // If same value, just set it directly
    if (from === to) {
      const whole = Math.floor(to).toLocaleString('en-US');
      const cents = (to % 1).toFixed(2).slice(1);
      const centsClass = isDark ? 'text-[20px] text-white/40' : 'text-[20px] text-[var(--color-text-secondary)]';
      amountRef.current.innerHTML =
        '$' + whole + '<span class="' + centsClass + '">' + cents + '</span>';
      return;
    }

    const target = { val: from };
    gsap.to(target, {
      val: to,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (amountRef.current) {
          const v = Math.floor(target.val);
          const c = (target.val % 1).toFixed(2).slice(1);
          const centsClass = isDark ? 'text-[20px] text-white/40' : 'text-[20px] text-[var(--color-text-secondary)]';
          amountRef.current.innerHTML =
            '$' + v.toLocaleString('en-US') +
            '<span class="' + centsClass + '">' + c + '</span>';
        }
      },
    });
  }, [dollars, isDark]);

  // Track specie count changes
  const specieCount = data.specieCount ?? null;

  return (
    <div ref={containerRef} className={
      isDark
        ? 'rounded-2xl bg-[#1A1A1A] p-5 my-2 shadow-sm'
        : 'rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm'
    }>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>
        {data.label}
      </p>
      <p ref={amountRef} className={`text-[32px] font-extralight tracking-tight leading-none ${isDark ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
        $0<span className={`text-[20px] ${isDark ? 'text-white/40' : 'text-[var(--color-text-secondary)]'}`}>.00</span>
      </p>
      {specieCount != null && (
        <p className={`text-xs mt-1.5 ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>
          {specieCount.toLocaleString()} SPECIES
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)]" />
        <span className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>{data.status}</span>
      </div>
    </div>
  );
}

registerUIComponent('BalanceCard', BalanceCardUI as unknown as React.ComponentType<GenUIProps>);
export { BalanceCardUI };
