'use client';

import { useRef, useEffect } from 'react';
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

function formatAmount(dollars: number, isDark: boolean) {
  const whole = Math.floor(dollars).toLocaleString('en-US');
  const cents = (dollars % 1).toFixed(2).slice(1);
  const cls = isDark ? 'text-[20px] text-white/40' : 'text-[20px] text-[var(--color-text-secondary)]';
  return '$' + whole + '<span class="' + cls + '">' + cents + '</span>';
}

function BalanceCardUI({ data }: GenUIProps<BalanceData>) {
  const rawAmount = data.amount ?? data.balance?.posted ?? 0;
  const dollars = rawAmount / 1_000_000;
  const isDark = data.variant === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLParagraphElement>(null);
  const displayedRef = useRef<number | null>(null); // what's currently shown
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Entrance animation (once)
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Update displayed value — only animate if value actually changed
  useEffect(() => {
    if (!amountRef.current) return;

    const current = displayedRef.current;

    // Same value — just set it (no animation)
    if (current !== null && current === dollars) {
      amountRef.current.innerHTML = formatAmount(dollars, isDark);
      return;
    }

    // Kill any running tween
    if (tweenRef.current) {
      tweenRef.current.kill();
      tweenRef.current = null;
    }

    const from = current ?? 0;
    displayedRef.current = dollars;

    // If first render or zero, just set directly
    if (from === 0 && dollars === 0) {
      amountRef.current.innerHTML = formatAmount(0, isDark);
      return;
    }

    // Animate from → to
    const target = { val: from };
    tweenRef.current = gsap.to(target, {
      val: dollars,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (amountRef.current) {
          amountRef.current.innerHTML = formatAmount(target.val, isDark);
        }
      },
      onComplete: () => {
        // Ensure final value is exact
        if (amountRef.current) {
          amountRef.current.innerHTML = formatAmount(dollars, isDark);
        }
        tweenRef.current = null;
      },
    });
  }, [dollars, isDark]);

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
