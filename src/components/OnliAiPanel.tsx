'use client';

import { cn } from '@/lib/utils';
import { useTabStore, type ChatMode } from '@/stores/tab-store';
import { GenUISlot } from './GenUISlot';
import { useSystemChat } from '@/hooks/useSystemChat';
const MODES: { key: ChatMode; label: string }[] = [
  { key: 'learn', label: 'Learn' },
  { key: 'ask', label: 'Ask' },
  { key: 'trade', label: 'Trade' },
];

export function OnliAiPanel() {
  const { chatMode, setChatMode } = useTabStore();
  const { welcomeMessage } = useSystemChat();

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

      {/* Mode selector — pill switch */}
      <div className="px-4 pb-3">
        <div className="rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)] mb-1">
            Onli Ai
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] mb-2.5">Modes</p>
          <div className="flex bg-[#EBEBEB] rounded-full p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setChatMode(m.key)}
                className={cn(
                  'flex-1 text-center py-2 text-[12px] rounded-full transition-all cursor-pointer',
                  chatMode === m.key
                    ? 'font-bold text-[var(--color-text-primary)] bg-white border border-[#E0E0E0] shadow-[0_2px_3px_rgba(10,13,18,0.05)]'
                    : 'font-medium text-[#858585]',
                )}
              >
                {m.label}
              </button>
            ))}
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
