'use client';

import { cn } from '@/lib/utils';
import { useTabStore, type ChatMode } from '@/stores/tab-store';
import { GenUISlot } from './GenUISlot';
import { useSystemChat } from '@/hooks/useSystemChat';
import { useState } from 'react';

const MODES: { key: ChatMode; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'trade', label: 'Trade' },
  { key: 'learn', label: 'Learn' },
];

export function OnliAiPanel() {
  const { chatMode, setChatMode } = useTabStore();
  const { welcomeMessage } = useSystemChat();
  const [modeOpen, setModeOpen] = useState(false);

  const currentModeLabel = MODES.find((m) => m.key === chatMode)?.label || 'Ask';

  return (
    <div className="flex flex-col h-full">
      {/* Welcome card */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Welcome to Onli Ai
        </h1>
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
          {welcomeMessage}
        </p>
      </div>

      {/* Onli ID card */}
      <div className="px-4 pb-2">
        <div className="rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-cta-primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                Alex Morgan
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)]" />
                <span className="text-[10px] text-[var(--color-text-secondary)]">Logged in</span>
              </div>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
              Onli ID
            </p>
          </div>
        </div>
      </div>

      {/* Mode selector card */}
      <div className="px-4 pb-3">
        <div className="rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
                Onli Ai
              </p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Modes
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setModeOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-white text-sm font-medium transition-colors hover:bg-[var(--color-bg-card)]',
                )}
              >
                {currentModeLabel}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={cn('transition-transform duration-200', modeOpen && 'rotate-180')}
                >
                  <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Dropdown */}
              {modeOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-white shadow-lg z-20 py-1 animate-fade-in">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setChatMode(m.key);
                        setModeOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm transition-colors',
                        chatMode === m.key
                          ? 'font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-card)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--color-border)]" />

      {/* System cards — takes remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <GenUISlot />
      </div>
    </div>
  );
}
