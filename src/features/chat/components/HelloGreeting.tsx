'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from '@/lib/gsap-config';

interface HelloGreetingProps {
  onComplete: () => void;
}

export function HelloGreeting({ onComplete }: HelloGreetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    const svgContainer = svgContainerRef.current;
    if (!svgContainer) return;

    let cancelled = false;

    fetch('/images/hello-text.svg')
      .then((res) => {
        if (!res.ok) throw new Error(`hello svg ${res.status}`);
        return res.text();
      })
      .then((svgText) => {
        if (cancelled) return;
        svgContainer.innerHTML = svgText;
        const svg = svgContainer.querySelector('svg');
        if (!svg) {
          setAnimDone(true);
          return;
        }

        const ellipses = svg.querySelectorAll('ellipse');
        gsap.set(ellipses, { autoAlpha: 0 });

        const tl = gsap.timeline({
          onComplete: () => setAnimDone(true),
        });

        tl.to(ellipses, {
          autoAlpha: 1,
          duration: 1,
          stagger: 0.05,
          ease: 'power4.out',
        });

        // 25% faster than the original 3 → 3.75
        tl.timeScale(3.75);
      })
      .catch(() => {
        if (!cancelled) setAnimDone(true);
      });

    return () => {
      cancelled = true;
      gsap.killTweensOf(svgContainer);
    };
  }, []);

  const dismissing = useRef(false);

  const handleDismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    const container = containerRef.current;
    if (!container) {
      onComplete();
      return;
    }
    gsap.to(container, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete,
    });
  }, [onComplete]);

  // Global click — clicking anywhere on the page dismisses the animation
  useEffect(() => {
    const handler = () => handleDismiss();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [handleDismiss]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center h-full cursor-pointer"
    >
      <div ref={svgContainerRef} className="w-[360px]" />
      {animDone && (
        <p className="mt-6 text-[13px] text-[var(--color-text-secondary)] animate-fade-in">
          Tap to continue
        </p>
      )}
    </div>
  );
}
