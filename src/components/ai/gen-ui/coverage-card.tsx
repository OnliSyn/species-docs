'use client';

import { useEffect, useRef, type ComponentType } from 'react';
import gsap from 'gsap';
import { AlertTriangle } from 'lucide-react';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';
import { normalizeAssuranceCoveragePayload } from '@/lib/normalize-assurance-coverage';

/** Server-shaped assurance snapshot + `_ui` — no client-side money or coverage math. */
type CoverageCardData = {
  _ui: string;
  assurancePosted: number;
  circulationSpecieCount: number;
  circulationValuePosted: number;
  coveragePercent: number;
  buyBackGuaranteeDollars: string;
  buyBackGuaranteeCents: string;
  assurancePostedDisplay: string;
  circulationValuePostedDisplay: string;
};

function CoverageCardUI({ data }: GenUIProps<CoverageCardData>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const snap = normalizeAssuranceCoveragePayload(data);
  const {
    circulationSpecieCount,
    coveragePercent,
    buyBackGuaranteeDollars,
    buyBackGuaranteeCents,
    assurancePostedDisplay,
    circulationValuePostedDisplay,
  } = snap;

  const circulationIdle = circulationSpecieCount <= 0;
  let statusLabel: string;
  let statusColor: string;
  if (circulationIdle) {
    statusLabel = 'Idle';
    statusColor = '#8A8A8A';
  } else if (coveragePercent > 100) {
    statusLabel = 'Surplus';
    statusColor = '#F4B251';
  } else if (coveragePercent < 100) {
    statusLabel = 'Attention';
    statusColor = '#F4B251';
  } else {
    statusLabel = 'Healthy';
    statusColor = '#B2D271';
  }

  const showHero = !circulationIdle;

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
        <span className="text-[13px] font-medium" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="mb-8 min-h-[56px]">
        {showHero ? (
          <div className="flex items-baseline">
            <span className="text-[56px] font-light text-[#171717] tracking-tight leading-none">
              ${buyBackGuaranteeDollars}
            </span>
            <span className="text-[36px] font-light text-[#737373] leading-none">.{buyBackGuaranteeCents}</span>
          </div>
        ) : (
          <div>
            <span className="text-[56px] font-light text-[#737373] tracking-tight leading-none" aria-hidden>
              —
            </span>
            <p className="mt-1 text-[13px] font-normal text-[#737373] leading-snug">
              No Specie in circulation — per-Specie backing applies once there is circulation.
            </p>
          </div>
        )}
      </div>

      {showHero && (
        <p className="text-[11px] font-medium text-[#737373] tabular-nums mb-6">
          Coverage ratio{' '}
          <span className="text-[#171717]">{coveragePercent}%</span>
        </p>
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[14px] text-[#737373]">Assurance Account</span>
          <span className="text-[14px] font-medium text-[#171717]">{assurancePostedDisplay}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[14px] text-[#737373]">Liability at peg</span>
          <span className="text-[14px] font-medium text-[#171717]">{circulationValuePostedDisplay}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[14px] text-[#737373]">Circulation</span>
          <span className="text-[14px] font-medium text-[#171717]">
            {circulationSpecieCount.toLocaleString()} SPECIES
          </span>
        </div>
      </div>

      {!circulationIdle && coveragePercent < 100 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#FFF9EB] p-4 text-[14px] text-[#A66108] leading-relaxed">
          <AlertTriangle className="mt-[2px] h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
          <div>
            Backing below 100%.<br />
            Assurance is less than the<br />
            full circulation value (server<br />
            snapshot).
          </div>
        </div>
      )}
    </div>
  );
}

registerUIComponent('CoverageCard', CoverageCardUI as ComponentType<GenUIProps>);
export { CoverageCardUI };
