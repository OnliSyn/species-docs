'use client';

import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type InfoData = {
  title: string;
  body: string;
  _ui: string;
};

function InfoCardUI({ data }: GenUIProps<InfoData>) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm">
      <p className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-1.5">
        {data.title}
      </p>
      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
        {data.body}
      </p>
    </div>
  );
}

registerUIComponent('InfoCard', InfoCardUI as unknown as React.ComponentType<GenUIProps>);
export { InfoCardUI };
