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
          amountRef.current.innerHTML =
            '$' + v.toLocaleString('en-US') +
            '<span class="text-[20px] text-[var(--color-text-secondary)]">' + c + '</span>';
        }
      },
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 max-w-xs shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-1">
        {data.label}
      </p>
      <p ref={amountRef} className="text-[32px] font-extralight tracking-tight text-[var(--color-text-primary)] leading-none">
        ${whole}<span className="text-[20px] text-[var(--color-text-secondary)]">{cents}</span>
      </p>
      {data.specieCount != null && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
          {data.specieCount.toLocaleString()} SPECIES
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)]" />
        <span className="text-[10px] text-[var(--color-text-secondary)]">{data.status}</span>
      </div>
    </div>
  );
}

registerUIComponent('BalanceCard', BalanceCardUI as unknown as React.ComponentType<GenUIProps>);
export { BalanceCardUI };
