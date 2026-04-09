'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
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
const PAUSE_AFTER_INTERACTION = 10_000;
const SWIPE_THRESHOLD = 50;

function RotatingFactCardUI({ data }: GenUIProps<RotatingFactData>) {
  const facts = data.facts ?? [];
  const title = data.title ?? 'Did you know?';
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * facts.length));
  const instanceRef = useRef(instanceCounter++);
  const stagger = STAGGER_OFFSETS[instanceRef.current % STAGGER_OFFSETS.length];
  const textRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Crossfade to a specific index — shared by auto-rotate, dots, swipe, and arrows
  const animateToIndex = useCallback((nextIdx: number) => {
    if (isAnimatingRef.current || nextIdx === idx || !textRef.current) return;
    isAnimatingRef.current = true;

    const direction = nextIdx > idx ? -1 : 1; // slide out left for forward, right for back
    gsap.to(textRef.current, {
      opacity: 0,
      y: direction * -8,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        setIdx(nextIdx);
        if (textRef.current) {
          gsap.fromTo(textRef.current,
            { opacity: 0, y: direction * 8 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', onComplete: () => { isAnimatingRef.current = false; } },
          );
        } else {
          isAnimatingRef.current = false;
        }
      },
    });
  }, [idx]);

  // Start / restart the auto-rotation interval
  const startAutoRotate = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!isAnimatingRef.current && textRef.current) {
        setIdx((prev) => {
          const next = (prev + 1) % facts.length;
          // Animate inline since we need the latest prev
          gsap.to(textRef.current, {
            opacity: 0, y: -8, duration: 0.3, ease: 'power2.in',
            onComplete: () => {
              if (textRef.current) {
                gsap.fromTo(textRef.current,
                  { opacity: 0, y: 8 },
                  { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
                );
              }
            },
          });
          return next;
        });
      }
    }, BASE_INTERVAL);
  }, [facts.length]);

  // Pause auto-rotation temporarily after user interaction, then resume
  const pauseAndResume = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    setIsPaused(true);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
      startAutoRotate();
    }, PAUSE_AFTER_INTERACTION);
  }, [startAutoRotate]);

  // Navigate to a specific fact (manual interaction)
  const goToFact = useCallback((nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= facts.length || nextIdx === idx) return;
    animateToIndex(nextIdx);
    pauseAndResume();
  }, [facts.length, idx, animateToIndex, pauseAndResume]);

  const goNext = useCallback(() => {
    goToFact((idx + 1) % facts.length);
  }, [idx, facts.length, goToFact]);

  const goPrev = useCallback(() => {
    goToFact((idx - 1 + facts.length) % facts.length);
  }, [idx, facts.length, goToFact]);

  // Entrance animation
  useGSAP(() => {
    gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.35, ease: 'power2.out' });
  }, { scope: containerRef });

  // Auto-rotate with staggered start
  useEffect(() => {
    if (facts.length <= 1) return;

    startTimeoutRef.current = setTimeout(() => {
      startAutoRotate();
    }, stagger);

    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [facts.length, stagger, startAutoRotate]);

  // Touch / swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);

  if (facts.length === 0) return null;

  const showNav = facts.length > 1;

  return (
    <div
      ref={containerRef}
      className="group relative rounded-2xl border border-[var(--color-border)] bg-white p-5 my-2 shadow-sm select-none"
      onTouchStart={showNav ? handleTouchStart : undefined}
      onTouchEnd={showNav ? handleTouchEnd : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          {title}
        </p>
        {showNav && (
          <div className="flex gap-1.5 items-center">
            {facts.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to fact ${i + 1}`}
                onClick={() => goToFact(i)}
                className={`block w-1.5 h-1.5 rounded-full transition-all duration-500 cursor-pointer hover:scale-150 ${
                  i === idx ? 'bg-[var(--color-text-primary)]' : 'bg-[var(--color-border)] hover:bg-[var(--color-text-secondary)]'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <p
        ref={textRef}
        className="text-[15px] text-[var(--color-text-primary)] leading-relaxed"
      >
        {facts[idx]}
      </p>

      {/* Desktop arrow navigation — visible on hover */}
      {showNav && (
        <>
          <button
            type="button"
            aria-label="Previous fact"
            onClick={goPrev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-border)]/60 hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] backdrop-blur-sm cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            type="button"
            aria-label="Next fact"
            onClick={goNext}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-border)]/60 hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] backdrop-blur-sm cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </>
      )}
    </div>
  );
}

registerUIComponent('RotatingFactCard', RotatingFactCardUI as unknown as React.ComponentType<GenUIProps>);
export { RotatingFactCardUI };
