'use client';

interface AssuranceCardProps {
  /** From GET /api/trade-panel — server-formatted, do not format client-side. */
  assurancePostedDisplay: string;
  /** Circulation count (Species sim). */
  circulationSpecieCount: number;
  buyBackGuaranteeDollars: string;
  buyBackGuaranteeCents: string;
  /** From server read-model (uncapped canary ratio). */
  coveragePercent: number;
}

export function AssuranceCard({
  assurancePostedDisplay,
  circulationSpecieCount,
  buyBackGuaranteeDollars,
  buyBackGuaranteeCents,
  coveragePercent,
}: AssuranceCardProps) {

  /** Trade-panel canary: coverage is uncapped; status reflects raw ratio vs 100% peg. */
  const circulationIdle = circulationSpecieCount <= 0;
  let statusLabel: string;
  let statusColor: string;
  if (circulationIdle) {
    statusLabel = 'Idle';
    statusColor = '#737373';
  } else if (coveragePercent > 100) {
    statusLabel = 'Surplus';
    statusColor = 'var(--color-accent-amber)';
  } else if (coveragePercent < 100) {
    statusLabel = coveragePercent >= 50 ? 'Warning' : 'Critical';
    statusColor = coveragePercent >= 50 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)';
  } else {
    statusLabel = 'Healthy';
    statusColor = '#B2D271';
  }

  const showBackingPerSpecie = circulationSpecieCount > 0;

  return (
    <div className="rounded-[1.25rem] bg-white border border-[#E5E5E5] p-5 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-[11px] font-medium text-[#737373] tracking-[0.1em] uppercase leading-tight w-24">
          Buy Back<br />Guarantee
        </h3>
        <span className="text-xs font-medium" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="mb-6 min-h-[3rem]">
        {showBackingPerSpecie ? (
          <div className="flex items-baseline">
            <span className="text-5xl font-light text-[#171717] tracking-tight">${buyBackGuaranteeDollars}</span>
            <span className="text-3xl font-light text-[#737373]">.{buyBackGuaranteeCents}</span>
          </div>
        ) : (
          <div>
            <span className="text-5xl font-light text-[#737373] tracking-tight" aria-hidden>
              —
            </span>
            <p className="mt-1 text-xs text-[#737373] leading-snug">
              No circulation — per-Specie backing appears once Specie are outstanding.
            </p>
          </div>
        )}
      </div>

      {showBackingPerSpecie && (
        <p className="text-[10px] text-[#737373] tabular-nums mb-3">
          <span className="font-medium">Coverage ratio </span>
          <span data-testid="assurance-coverage-display" className="font-medium text-[#171717]">
            {coveragePercent}%
          </span>
        </p>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#737373]">Assurance Account</span>
          <span className="text-xs font-medium text-[#171717]" data-testid="assurance-balance-display">
            {assurancePostedDisplay}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#737373]">Circulation</span>
          <span className="text-xs font-medium text-[#171717]">
            {circulationSpecieCount.toLocaleString()} SPECIES
          </span>
        </div>
      </div>
    </div>
  );
}
