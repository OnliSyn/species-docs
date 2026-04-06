'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'onli-synth-disclaimer-seen';

export function SimulationDisclaimer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);

  if (!show) return null;

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md mx-4 overflow-hidden animate-slide-in-left">
        {/* Header */}
        <div className="bg-[#1A1A1A] px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-green)] flex items-center justify-center">
              <span className="text-lg">✦</span>
            </div>
            <div>
              <h2 className="text-white text-lg font-bold">Onli Synth</h2>
              <p className="text-white/50 text-[10px] uppercase tracking-widest">Simulation Environment</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-[13px] text-[var(--color-text-primary)] leading-relaxed mb-4">
            Welcome to the <strong>Onli Synth Playground</strong> — a live simulation of the Onli AI interface and Species Marketplace infrastructure.
          </p>

          <div className="space-y-2.5 mb-5">
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--color-accent-green)] text-sm mt-0.5">●</span>
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                The infrastructure is <strong>live</strong> — real MarketSB cashier, Species pipeline, and Oracle systems are running.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--color-accent-green)] text-sm mt-0.5">●</span>
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                All assets are marked <strong>for development only</strong> and cannot be traded on the Onli One Network.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-[var(--color-accent-green)] text-sm mt-0.5">●</span>
              <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                <strong>Do not send real USDC.</strong> Deposits and withdrawals are simulated.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            This is a playground for experimenting with the UI, testing transactions, and exploring how Onli works.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleAccept}
            className="w-full py-2.5 rounded-xl bg-[var(--color-cta-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            I understand — enter the playground
          </button>
        </div>
      </div>
    </div>
  );
}
