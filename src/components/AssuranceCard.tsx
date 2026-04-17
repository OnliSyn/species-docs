'use client';

import { formatUsdcDisplay } from '@/lib/amount';

interface AssuranceCardProps {
  assuranceBalance: bigint;
  totalOutstanding: bigint;
  /** Pre-computed on the server from sim balances (UI does not derive coverage). */
  coveragePercent: number;
}

export function AssuranceCard({ assuranceBalance, totalOutstanding, coveragePercent }: AssuranceCardProps) {

  const statusColor = coveragePercent >= 100
    ? '#B2D271'
    : coveragePercent >= 50
      ? 'var(--color-accent-amber)'
      : 'var(--color-accent-red)';
      
  const label = coveragePercent >= 100 ? 'Healthy' : coveragePercent >= 50 ? 'Warning' : 'Critical';

  // Derive simple counts
  const circulationSpecieCount = totalOutstanding ? Number(totalOutstanding / 1000000n) : 0;

  return (
    <div className="rounded-[1.25rem] bg-white border border-[#E5E5E5] p-5 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-[11px] font-medium text-[#737373] tracking-[0.1em] uppercase leading-tight w-24">
          Buy Back<br />Guarantee
        </h3>
        <span className="text-xs font-medium" style={{ color: statusColor }}>
          {label}
        </span>
      </div>

      <div className="mb-6 flex items-baseline">
        <span className="text-5xl font-light text-[#171717] tracking-tight">$1</span>
        <span className="text-3xl font-light text-[#737373]">.00</span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#737373]">Assurance Account</span>
          <span className="text-xs font-medium text-[#171717]">
            {formatUsdcDisplay(assuranceBalance)}
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
