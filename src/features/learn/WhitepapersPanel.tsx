'use client';

const WHITEPAPERS = [
  {
    id: '01',
    title: 'The Verisimilitude of Digital Assets',
    subtitle: 'A critique of blockchain as simulation rather than genuine finance',
    category: 'Foundation',
    year: '2010',
  },
  {
    id: '02',
    title: 'The Physics of Finance',
    subtitle: 'Financial system mechanics and theoretical foundations',
    category: 'Theory',
    year: '2012',
  },
  {
    id: '03',
    title: 'Uniqueness-Quantification',
    subtitle: 'Creating singular, non-replicable digital objects — the Ledger Fallacy',
    category: 'Core Architecture',
    year: '2015',
  },
  {
    id: '04',
    title: 'Infrastructure Sharing Scheme',
    subtitle: 'Operational and deployment infrastructure for digital asset management',
    category: 'Infrastructure',
    year: '2020',
  },
  {
    id: '05',
    title: 'The BottomLine',
    subtitle: 'Summary and conclusions of the Onli thesis',
    category: 'Summary',
    year: '2025',
  },
];

const CANON = [
  {
    id: 'canon-kb',
    title: 'Onli Knowledge Base',
    subtitle: 'Authoritative reference for Genomes, Genes, Vaults, and Appliances',
    category: 'Canon',
  },
  {
    id: 'canon-founders',
    title: 'Founders',
    subtitle: 'The story behind Onli',
    category: 'Canon',
  },
  {
    id: 'canon-singularity',
    title: 'The Singularity of Ownership',
    subtitle: 'Why actual possession changes everything',
    category: 'Canon',
    year: '2025',
  },
];

export function WhitepapersPanel() {
  return (
    <div className="space-y-4">
      {/* Whitepapers */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
          Whitepapers
        </h3>
        <div className="space-y-2">
          {WHITEPAPERS.map((paper) => (
            <button
              key={paper.id}
              className="w-full text-left rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] hover:bg-[var(--color-bg-card)] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                    {paper.title}
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {paper.subtitle}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] flex-shrink-0">
                  {paper.year}
                </span>
              </div>
              <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-green)]/20 text-[var(--color-text-primary)]">
                {paper.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Onli Canon */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-3">
          Onli Canon
        </h3>
        <div className="space-y-2">
          {CANON.map((entry) => (
            <button
              key={entry.id}
              className="w-full text-left rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] hover:bg-[var(--color-bg-card)] transition-colors"
            >
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                {entry.title}
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {entry.subtitle}
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-accent-amber)]/20 text-[var(--color-text-primary)]">
                {entry.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
