'use client';

interface StatsData {
  totalOrders: number;
  completedOrders: number;
  totalVolumeSpecie: number;
  activeListings: number;
  treasuryCount: number;
}

export function MarketStatsCard({ data }: { data: StatsData }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] my-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
        Marketplace Overview
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Orders', value: data.totalOrders?.toLocaleString() },
          { label: 'Completed', value: data.completedOrders?.toLocaleString() },
          { label: 'Volume', value: `${(data.totalVolumeSpecie || 0).toLocaleString()} SPECIES` },
          { label: 'Active Listings', value: data.activeListings?.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="p-2 rounded-lg bg-[var(--color-bg-card)]">
            <p className="text-[10px] text-[var(--color-text-secondary)]">{stat.label}</p>
            <p className="text-sm font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
