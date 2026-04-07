'use client';

import { useState, useRef, useCallback } from 'react';
import { gsap } from '@/lib/gsap-config';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { SimulationDisclaimer } from '@/components/SimulationDisclaimer';
import { MobileGate } from '@/components/MobileGate';
import { CoverPage } from '@/components/CoverPage';

function hasEnteredBefore(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('onli-entered') === 'true';
}

export default function HomePage() {
  const [showCover, setShowCover] = useState(() => !hasEnteredBefore());
  const coverRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    const cover = coverRef.current;
    if (!cover) {
      localStorage.setItem('onli-entered', 'true');
      setShowCover(false);
      return;
    }

    const inner = cover.querySelector('.cover-inner') as HTMLElement;

    // Codrops-inspired transition: cover scales down with parallax
    // inner content, revealing dashboard already in place underneath
    const tl = gsap.timeline({
      defaults: { duration: 1.1, ease: 'power2.inOut' },
      onComplete: () => {
        localStorage.setItem('onli-entered', 'true');
        setShowCover(false);
      },
    });

    tl.addLabel('start', 0)
      // Cover container: scale down + fade out
      .to(cover, { scale: 0.85, autoAlpha: 0, duration: 1.1 }, 'start')
      // Inner content: counter-scale creates parallax depth
      .to(inner, { scale: 1.3, duration: 1.1 }, 'start');
  }, []);

  return (
    <MobileGate>
      <SimulationDisclaimer />

      {/* Dashboard — always rendered, cover overlays on top */}
      <DashboardLayout
        leftPanel={<OnliAiPanel />}
        centerPanel={<ChatPanel />}
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
