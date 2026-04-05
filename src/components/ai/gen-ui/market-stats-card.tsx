'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type StatsData = { totalOrders: number; completedOrders: number; totalVolumeSpecie: number; activeListings: number; _ui: string };

function MarketStatsUI({ data }: GenUIProps<StatsData>) {
  const stats = [
    { label: 'Orders', value: (data.totalOrders || 0).toLocaleString() },
    { label: 'Completed', value: (data.completedOrders || 0).toLocaleString() },
    { label: 'Volume', value: `${(data.totalVolumeSpecie || 0).toLocaleString()} SP` },
    { label: 'Listings', value: (data.activeListings || 0).toLocaleString() },
  ];
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
    gsap.from('.stats-item', { y: 8, opacity: 0, duration: 0.2, stagger: 0.06, delay: 0.2, ease: 'power2.out' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm max-w-xs">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-3">Marketplace</p>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(s => (
          <div key={s.label} className="stats-item p-2 rounded-lg bg-[var(--color-bg-card)]">
            <p className="text-[9px] text-[var(--color-text-secondary)]">{s.label}</p>
            <p className="text-sm font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

registerUIComponent('MarketStats', MarketStatsUI as unknown as React.ComponentType<GenUIProps>);
export { MarketStatsUI };
