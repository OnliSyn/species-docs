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

function MarketStatsUI({ data }: GenUIProps<StatsData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listedRef = useRef<HTMLParagraphElement>(null);
  const treasuryRef = useRef<HTMLSpanElement>(null);
  const prevListedRef = useRef(0);
  const prevTreasuryRef = useRef(0);

  const listed = data.listedSpecieCount ?? data.totalVolumeSpecie ?? 0;
  const treasury = data.treasuryCount ?? 0;

  // Entrance animation
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Animated counter for Listed for Sale
  useEffect(() => {
    if (!listedRef.current) return;
    const from = prevListedRef.current;
    const to = listed;
    prevListedRef.current = listed;

    if (from === to) {
      listedRef.current.textContent = to.toLocaleString('en-US');
      return;
    }

    const target = { val: from };
    gsap.to(target, {
      val: to,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (listedRef.current) {
          listedRef.current.textContent = Math.floor(target.val).toLocaleString('en-US');
        }
      },
    });
  }, [listed]);

  // Animated counter for Treasury
  useEffect(() => {
    if (!treasuryRef.current) return;
    const from = prevTreasuryRef.current;
    const to = treasury;
    prevTreasuryRef.current = treasury;

    if (from === to) {
      treasuryRef.current.textContent = to.toLocaleString('en-US');
      return;
    }

    const target = { val: from };
    gsap.to(target, {
      val: to,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (treasuryRef.current) {
          treasuryRef.current.textContent = Math.floor(target.val).toLocaleString('en-US');
        }
      },
    });
  }, [treasury]);

  return (
    <div ref={containerRef} className="rounded-2xl bg-[#1A1A1A] p-5 my-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 text-white/50">
        Marketplace
      </p>

      {/* Hero: Listed for Sale */}
      <p className="text-[32px] font-extralight tracking-tight leading-none text-white">
        <span ref={listedRef}>0</span>
        <span className="text-[20px] text-white/40 ml-1">SP</span>
      </p>
      <p className="text-xs mt-1.5 text-white/50">
        Listed for Sale
      </p>

      {/* Treasury */}
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
