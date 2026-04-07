'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type ConfirmData = {
  title: string;
  lines: { label: string; value: string; bold?: boolean }[];
  warning?: string;
  _ui: string;
};

function ConfirmCardUI({ data }: GenUIProps<ConfirmData>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 20, opacity: 0, duration: 0.4, ease: 'back.out(1.4)' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden my-2 shadow-sm max-w-xs">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
          {data.title}
        </p>
      </div>
      <div className="px-5 pb-3 space-y-2">
        {data.lines.map((line, i) => (
          <div key={i} className={`flex justify-between text-xs ${line.bold ? 'pt-2 border-t border-[var(--color-border)]' : ''}`}>
            <span className="text-[var(--color-text-secondary)]">{line.label}</span>
            <span className={line.bold ? 'font-bold' : 'font-medium'}>{line.value}</span>
          </div>
        ))}
      </div>
      {data.warning && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-[var(--color-accent-red)]/5 text-[10px] text-[var(--color-accent-red)]">
          {data.warning}
        </div>
      )}
      {/* Onli You authorization indicator */}
      <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-[#D4F5A0]/20 border border-[#D4F5A0]/40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-primary)]">Authorized via Onli You</span>
      </div>
      <div className="border-t border-[var(--color-border)] px-5 py-3 bg-[var(--color-bg-card)]">
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Type <span className="font-semibold text-[var(--color-text-primary)]">confirm</span> to proceed or <span className="font-semibold text-[var(--color-text-primary)]">cancel</span> to abort.
        </p>
      </div>
    </div>
  );
}

registerUIComponent('ConfirmCard', ConfirmCardUI as unknown as React.ComponentType<GenUIProps>);
export { ConfirmCardUI };
