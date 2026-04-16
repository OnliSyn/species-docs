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
      className="rounded-[20px] border border-white/10 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-5 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#C5DE8A]" />
          <span className="text-sm font-semibold uppercase tracking-wider text-white/90">
            Buy Back Guarantee
          </span>
        </div>
        <span
          className={`text-xs font-medium uppercase ${healthy ? 'text-[#C5DE8A]' : 'text-amber-400'}`}
        >
          {healthy ? 'Healthy' : 'Attention'}
        </span>
      </div>

      <div className="mb-1 text-center">
        <div className="text-4xl font-bold tabular-nums tracking-tight text-white">
          <span className="text-white/90">$</span>
          <span>1</span>
          <span className="text-2xl font-semibold text-white/80">.00</span>
        </div>
        <p className="mt-1 text-xs text-white/50">Redemption peg — $1.00 USDC per Specie</p>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Assurance Account</span>
          <span className="font-mono font-medium text-white">{assuranceStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Circulation value</span>
          <span className="font-mono font-medium text-white">{circulationValueStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Circulation</span>
          <span className="font-mono font-medium text-[#C5DE8A]">
            {circulationSpecieCount.toLocaleString()} SPECIES
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Backing (sim snapshot)</span>
          <span className="font-mono font-medium text-white">{coveragePercent}%</span>
        </div>
      </div>

      {!healthy && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Backing below 100%. Assurance is less than $1 × circulation value (server snapshot).</span>
        </div>
      )}
    </div>
  );
}

registerUIComponent('CoverageCard', CoverageCardUI as ComponentType<GenUIProps>);
export { CoverageCardUI };
