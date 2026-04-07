'use client';

import { useRef, useEffect } from 'react';
import { gsap } from '@/lib/gsap-config';

interface HelloGreetingProps {
  onComplete: () => void;
}

export function HelloGreeting({ onComplete }: HelloGreetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgContainer = svgContainerRef.current;
    if (!container || !svgContainer) return;

    fetch('/images/hello-text.svg')
      .then((res) => res.text())
      .then((svgText) => {
        svgContainer.innerHTML = svgText;
        const svg = svgContainer.querySelector('svg');
        if (!svg) return;

        const ellipses = svg.querySelectorAll('ellipse');

        // Initial state: all ellipses hidden, no scale
        gsap.set(ellipses, { autoAlpha: 0 });

        const tl = gsap.timeline({
          onComplete: () => {
            gsap.to(container, {
              opacity: 0,
              duration: 0.6,
              delay: 0.5,
              ease: 'power2.in',
              onComplete,
            });
          },
        });

        // Reveal ellipses with stagger only — no zoom
        tl.to(ellipses, {
          autoAlpha: 1,
          duration: 1,
          stagger: 0.05,
          ease: 'power4.out',
        });

        tl.timeScale(2.25);
      });

    return () => {
      gsap.killTweensOf(container);
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center h-full"
    >
      <div ref={svgContainerRef} className="w-[360px]" />
    </div>
  );
}
