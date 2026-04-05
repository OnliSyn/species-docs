'use client';

import { useRef, useState, useEffect } from 'react';
import { gsap, useGSAP } from '@/lib/gsap-config';
import { registerUIComponent, type GenUIProps } from '@/lib/ai/ui-registry';

type RotatingFactData = {
  facts: string[];
  title?: string;
  _ui: string;
};

// Each card instance gets a unique staggered interval so they don't all rotate at once
let instanceCounter = 0;
const BASE_INTERVAL = 60_000;
const STAGGER_OFFSETS = [0, 15_000, 35_000, 50_000, 8_000, 22_000, 42_000, 55_000];

function RotatingFactCardUI({ data }: GenUIProps<RotatingFactData>) {
  const facts = data.facts ?? [];
  const title = data.title ?? 'Did you know?';
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * facts.length));
  const instanceRef = useRef(instanceCounter++);
  const stagger = STAGGER_OFFSETS[instanceRef.current % STAGGER_OFFSETS.length];
  const textRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Rotate with crossfade — staggered start so cards don't all flip at once
  useEffect(() => {
    if (facts.length <= 1) return;

    let timer: ReturnType<typeof setInterval>;
    const startTimeout = setTimeout(() => {
      timer = setInterval(() => {
      if (textRef.current) {
        gsap.to(textRef.current, {
          opacity: 0,
          y: -8,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            setIdx((prev) => (prev + 1) % facts.length);
            if (textRef.current) {
              gsap.fromTo(textRef.current,
                { opacity: 0, y: 8 },
                { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
              );
            }
          },
        });
      }
      }, BASE_INTERVAL);
    }, stagger);

    return () => { clearTimeout(startTimeout); clearInterval(timer!); };
  }, [facts.length, stagger]);

  if (facts.length === 0) return null;

  return (
    <div ref={containerRef} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          {title}
        </p>
        {facts.length > 1 && (
          <div className="flex gap-1">
            {facts.map((_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                  i === idx ? 'bg-[var(--color-text-primary)]' : 'bg-[var(--color-border)]'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <p
        ref={textRef}
        className="text-[13px] text-[var(--color-text-primary)] leading-relaxed"
      >
        {facts[idx]}
      </p>
    </div>
  );
}

registerUIComponent('RotatingFactCard', RotatingFactCardUI as unknown as React.ComponentType<GenUIProps>);
export { RotatingFactCardUI };
