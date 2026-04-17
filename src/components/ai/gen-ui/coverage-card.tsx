'use client';

import { useEffect, useRef, type ComponentType } from 'react';
import gsap from 'gsap';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatUsdcDisplay } from '@/lib/amount';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';
import { normalizeAssuranceCoveragePayload } from '@/lib/normalize-assurance-coverage';

/** Matches `AssuranceCoverageSnapshot` from sim + `_ui` for generative UI routing */
type CoverageCardData = {
  _ui: string;
  assurancePosted: number;
  circulationSpecieCount: number;
  circulationValuePosted: number;
  coveragePercent: number;
};

function CoverageCardUI({ data }: GenUIProps<CoverageCardData>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const { assurancePosted, circulationSpecieCount, circulationValuePosted, coveragePercent }
    = normalizeAssuranceCoveragePayload(data);

  const healthy = coveragePercent >= 100;
  const assuranceStr = formatUsdcDisplay(BigInt(assurancePosted));
  const circulationValueStr = formatUsdcDisplay(BigInt(circulationValuePosted));

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      );
    }, cardRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={cardRef}
      className="rounded-[1.25rem] bg-white border border-[#E5E5E5] p-5 shadow-sm"
    >
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-[11px] font-medium text-[#737373] tracking-[0.1em] uppercase leading-tight w-24">
          Buy Back<br />Guarantee
        </h3>
        <span
          className="text-xs font-medium" style={{ color: healthy ? '#B2D271' : 'var(--color-accent-amber)' }}
        >
          {healthy ? 'Healthy' : 'Attention'}
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
            {assuranceStr}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#737373]">Circulation</span>
          <span className="text-xs font-medium text-[#171717]">
            {circulationSpecieCount.toLocaleString()} SPECIES
          </span>
        </div>
      </div>

      {!healthy && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>Backing below 100%. Assurance is less than $1 × circulation value (server snapshot).</span>
        </div>
      )}
    </div>
  );
}

registerUIComponent('CoverageCard', CoverageCardUI as ComponentType<GenUIProps>);
export { CoverageCardUI };
