'use client';

export function AdsPanel() {
  const promos = [
    {
      title: 'Upgrade to Premium',
      description: 'Unlock advanced analytics, priority support, and higher transaction limits.',
      cta: 'Learn More',
      accent: true,
    },
    {
      title: 'Onli Cloud',
      description: 'Actual possession of digital assets. No blockchain, no ledger — just ownership.',
      cta: 'Explore',
      accent: false,
    },
    {
      title: 'Species Marketplace',
      description: 'Buy, sell, and transfer Specie with instant settlement and 100% assurance backing.',
      cta: 'Start Trading',
      accent: false,
    },
    {
      title: 'Developer API',
      description: 'Build on Onli with our MCP-compatible API. Issue, transfer, and manage digital assets.',
      cta: 'View Docs',
      accent: false,
    },
  ];

  return (
    <div className="space-y-3">
      {promos.map((promo) => (
        <div
          key={promo.title}
          className={`rounded-[var(--radius-card)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-card)] ${
            promo.accent ? 'bg-[var(--color-accent-green)]/10' : 'bg-white'
          }`}
        >
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1.5">
            {promo.title}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed">
            {promo.description}
          </p>
          <button className="px-4 py-1.5 rounded-[var(--radius-button)] bg-[var(--color-cta-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            {promo.cta}
          </button>
        </div>
      ))}
    </div>
  );
}
