'use client';

import { useRef } from 'react';
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
  const whole = Math.floor(dollars).toLocaleString('en-US');
  const cents = (dollars % 1).toFixed(2).slice(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });

    // Counter animation on the dollar amount
    const target = { val: 0 };
    gsap.to(target, {
      val: dollars,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.2,
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
  }, { scope: containerRef });

  const isDark = data.variant === 'dark';

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
        ${whole}<span className={`text-[20px] ${isDark ? 'text-white/40' : 'text-[var(--color-text-secondary)]'}`}>{cents}</span>
      </p>
      {data.specieCount != null && (
        <p className={`text-xs mt-1.5 ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>
          {data.specieCount.toLocaleString()} SPECIES
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
