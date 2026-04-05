'use client';

export function MarketPanel() {
  const stats = [
    { label: 'Total Orders', value: '12,847' },
    { label: 'Orders Today', value: '342' },
    { label: 'Avg Order Size', value: '$1,250.00' },
    { label: 'Unique Users', value: '2,156' },
    { label: '24h Volume', value: '$427,500.00' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        Market Overview
      </h3>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] flex justify-between items-baseline"
        >
          <span className="text-xs text-[var(--color-text-secondary)]">{stat.label}</span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
