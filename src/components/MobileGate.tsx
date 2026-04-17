'use client';

import { useState, useEffect } from 'react';

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
      setChecked(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Avoid blank screen: first paint shows shell until viewport is classified
  if (!checked) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-text-primary)]" />
        <p className="text-xs">Loading…</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-8 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white font-light">O</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Onli Synth</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#999] mt-1">Simulation Playground</p>
        </div>

        {/* Message */}
        <div className="max-w-sm">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-3">
            Desktop Experience Only
          </h2>
          <p className="text-[13px] text-[#666] leading-relaxed mb-6">
            Onli Synth is a three-panel dashboard designed for desktop browsers. The full experience — AI chat, live trading simulations, and real-time system panels — requires a wider screen.
          </p>
          <p className="text-[12px] text-[#999] leading-relaxed mb-8">
            Please visit on a desktop or laptop computer to explore the playground.
          </p>

          {/* URL display */}
          <div className="bg-[#F5F5F5] rounded-xl px-4 py-3 mb-6">
            <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Visit on desktop</p>
            <p className="text-[13px] font-mono text-[#1A1A1A] font-medium">onli-synth.fly.dev</p>
          </div>

          {/* Onli branding */}
          <div className="flex items-center justify-center gap-2 text-[#CCC]">
            <span className="text-[10px]">Powered by</span>
            <span className="text-[11px] font-bold text-[#999]">Onli</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
