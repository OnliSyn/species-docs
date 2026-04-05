'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type VaultData = { count: number; _ui: string };

function VaultCardUI({ data }: GenUIProps<VaultData>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm max-w-xs">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-1">Onli Vault</p>
      <p className="text-[28px] font-extralight tracking-tight leading-none">
        {(data.count || 0).toLocaleString()} <span className="text-sm text-[var(--color-text-secondary)]">SPECIES</span>
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
        ≈ ${(data.count || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

registerUIComponent('VaultCard', VaultCardUI as unknown as React.ComponentType<GenUIProps>);
export { VaultCardUI };
