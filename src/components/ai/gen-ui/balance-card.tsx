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
  subtype?: string;
  specieCount?: number;
  variant?: 'light' | 'dark';
  _ui: string;
};

function BalanceCardUI({ data }: GenUIProps<BalanceData>) {
  const isDark = data.variant === 'dark';
  const isTrading = data.subtype === 'trading' || isDark;

  // Trading account: show species count as hero number
  // Funding account: show USDC dollar amount
  const rawAmount = data.amount ?? data.balance?.posted ?? 0;
  const dollars = rawAmount / 1_000_000;
  const specieCount = data.specieCount ?? 0;
  const heroValue = isTrading ? specieCount : dollars;
  const prefix = isTrading ? 'ø' : '$';

  const containerRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLParagraphElement>(null);
  const displayedRef = useRef<number | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  useEffect(() => {
    if (!amountRef.current) return;
    const current = displayedRef.current;
    if (current !== null && current === heroValue) {
      // Same value — just set
      amountRef.current.innerHTML = formatHero(heroValue, prefix, isDark, isTrading);
      return;
    }
    if (tweenRef.current) { tweenRef.current.kill(); tweenRef.current = null; }
    const from = current ?? 0;
    displayedRef.current = heroValue;
    if (from === 0 && heroValue === 0) {
      amountRef.current.innerHTML = formatHero(0, prefix, isDark, isTrading);
      return;
    }
    const target = { val: from };
    tweenRef.current = gsap.to(target, {
      val: heroValue,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (amountRef.current) amountRef.current.innerHTML = formatHero(target.val, prefix, isDark, isTrading);
      },
      onComplete: () => {
        if (amountRef.current) amountRef.current.innerHTML = formatHero(heroValue, prefix, isDark, isTrading);
        tweenRef.current = null;
      },
    });
  }, [heroValue, isDark, isTrading, prefix]);

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
        {prefix}0
      </p>
      {isTrading && (
        <p className={`text-xs mt-1.5 ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>
          SPECIES
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)]" />
        <span className={`text-[10px] ${isDark ? 'text-white/50' : 'text-[var(--color-text-secondary)]'}`}>{data.status}</span>
      </div>
    </div>
  );
}

function formatHero(value: number, prefix: string, isDark: boolean, isTrading: boolean): string {
  if (isTrading) {
    // Species count — whole number, no decimals
    const whole = Math.floor(value).toLocaleString('en-US');
    return prefix + whole;
  }
  // USDC dollars — with cents
  const whole = Math.floor(value).toLocaleString('en-US');
  const cents = (value % 1).toFixed(2).slice(1);
  const cls = isDark ? 'text-[20px] text-white/40' : 'text-[20px] text-[var(--color-text-secondary)]';
  return prefix + whole + '<span class="' + cls + '">' + cents + '</span>';
}

registerUIComponent('BalanceCard', BalanceCardUI as unknown as React.ComponentType<GenUIProps>);
export { BalanceCardUI };
