'use client';

import { useRef, useEffect } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type StatsData = {
  listedSpecieCount?: number;
  treasuryCount?: number;
  activeListings?: number;
  totalOrders?: number;
  completedOrders?: number;
  totalVolumeSpecie?: number;
  _ui: string;
};

function animateCounter(
  el: HTMLElement | null,
  displayedRef: { current: number | null },
  tweenRef: { current: gsap.core.Tween | null },
  target: number,
  suffix: string,
) {
  if (!el) return;
  const current = displayedRef.current;
  if (current !== null && current === target) return; // no change
  if (tweenRef.current) { tweenRef.current.kill(); tweenRef.current = null; }
  const from = current ?? 0;
  displayedRef.current = target;
  if (from === 0 && target === 0) { el.textContent = `0${suffix}`; return; }
  const obj = { val: from };
  tweenRef.current = gsap.to(obj, {
    val: target,
    duration: 0.8,
    ease: 'power2.out',
    onUpdate: () => { if (el) el.textContent = Math.floor(obj.val).toLocaleString('en-US'); },
    onComplete: () => { if (el) el.textContent = Math.floor(target).toLocaleString('en-US'); tweenRef.current = null; },
  });
}

function MarketStatsUI({ data }: GenUIProps<StatsData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listedRef = useRef<HTMLSpanElement>(null);
  const treasuryRef = useRef<HTMLSpanElement>(null);
  const listedDisplayed = useRef<number | null>(null);
  const treasuryDisplayed = useRef<number | null>(null);
  const listedTween = useRef<gsap.core.Tween | null>(null);
  const treasuryTween = useRef<gsap.core.Tween | null>(null);

  const listed = data.listedSpecieCount ?? data.totalVolumeSpecie ?? 0;
  const treasury = data.treasuryCount ?? 0;

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  useEffect(() => { animateCounter(listedRef.current, listedDisplayed, listedTween, listed, ''); }, [listed]);
  useEffect(() => { animateCounter(treasuryRef.current, treasuryDisplayed, treasuryTween, treasury, ''); }, [treasury]);

  return (
    <div ref={containerRef} className="rounded-2xl bg-[#1A1A1A] p-5 my-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 text-white/50">
        Marketplace
      </p>
      <p className="text-[32px] font-extralight tracking-tight leading-none text-white">
        <span ref={listedRef}>0</span>
        <span className="text-[20px] text-white/40 ml-1">SP</span>
      </p>
      <p className="text-xs mt-1.5 text-white/50">Listed for Sale</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <span className="text-[10px] text-white/40">Treasury</span>
        <span className="text-xs font-semibold text-white/70">
          <span ref={treasuryRef}>0</span> SP
        </span>
      </div>
    </div>
  );
}

registerUIComponent('MarketStats', MarketStatsUI as unknown as React.ComponentType<GenUIProps>);
export { MarketStatsUI };
