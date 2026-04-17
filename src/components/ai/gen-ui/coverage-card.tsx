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

  const calcRatio = () => {
    if (circulationSpecieCount === 0) return '1.00';
    const assuranceDollars = assurancePosted / 1_000_000;
    return (assuranceDollars / circulationSpecieCount).toFixed(2);
  };
  const [dollars, cents] = calcRatio().split('.');

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
      className="rounded-[1.5rem] bg-white border border-[#E5E5E5] p-6 shadow-sm"
    >
      <div className="flex justify-between items-start mb-8">
        <h3 className="text-[11px] font-medium text-[#8A8A8A] tracking-[0.15em] uppercase leading-relaxed w-28">
          Buy Back<br />Guarantee
        </h3>
        <span
          className="text-[13px] font-medium" style={{ color: healthy ? '#B2D271' : '#F4B251' }}
        >
          {healthy ? 'Healthy' : 'Attention'}
        </span>
      </div>

      <div className="mb-8 flex items-baseline">
        <span className="text-[56px] font-light text-[#171717] tracking-tight leading-none">${dollars}</span>
        <span className="text-[36px] font-light text-[#737373] leading-none">.{cents}</span>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[14px] text-[#737373]">Assurance Account</span>
          <span className="text-[14px] font-medium text-[#171717]">
            {assuranceStr}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[14px] text-[#737373]">Circulation</span>
          <span className="text-[14px] font-medium text-[#171717]">
            {circulationSpecieCount.toLocaleString()} SPECIES
          </span>
        </div>
      </div>

      {!healthy && (
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#FFF9EB] p-4 text-[14px] text-[#A66108] leading-relaxed">
          <AlertTriangle className="mt-[2px] h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
          <div>
            Backing below 100%.<br />
            Assurance is less than $1 ×<br />
            circulation value (server<br />
            snapshot).
          </div>
        </div>
      )}
    </div>
  );
}

registerUIComponent('CoverageCard', CoverageCardUI as ComponentType<GenUIProps>);
export { CoverageCardUI };
