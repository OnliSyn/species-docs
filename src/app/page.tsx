'use client';

import { useState, useRef, useCallback } from 'react';
import { gsap } from '@/lib/gsap-config';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { MobileGate } from '@/components/MobileGate';
import { CoverPage } from '@/components/CoverPage';

export default function HomePage() {
  const [showCover, setShowCover] = useState(true);
  const coverRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    const cover = coverRef.current;
    if (!cover) {
      setShowCover(false);
      return;
    }

    const inner = cover.querySelector('.cover-inner') as HTMLElement;

    // Safety fallback — if GSAP animation doesn't complete, force dismiss
    const fallbackTimer = setTimeout(() => setShowCover(false), 1500);

    try {
      // Codrops-inspired transition: cover scales down with parallax
      // inner content, revealing dashboard already in place underneath
      const tl = gsap.timeline({
        defaults: { duration: 1.1, ease: 'power2.inOut' },
        onComplete: () => {
          clearTimeout(fallbackTimer);
          setShowCover(false);
        },
      });

      tl.addLabel('start', 0)
        // Cover container: scale down + fade out
        .to(cover, { scale: 0.85, opacity: 0, duration: 1.1 }, 'start')
        // Inner content: counter-scale creates parallax depth
        .to(inner, { scale: 1.3, duration: 1.1 }, 'start');
    } catch {
      clearTimeout(fallbackTimer);
      setShowCover(false);
    }
  }, []);

  return (
    <MobileGate>
      {/* Dashboard — always rendered, cover overlays on top */}
      <DashboardLayout
        leftPanel={<OnliAiPanel />}
        centerPanel={<ChatPanel coverDismissed={!showCover} />}
        rightPanel={<RightPanel />}
      />

      {/* Cover page overlay */}
      {showCover && (
        <div ref={coverRef} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <CoverPage onEnter={handleEnter} />
        </div>
      )}
    </MobileGate>
  );
}
