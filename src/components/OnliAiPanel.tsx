'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTabStore, type ChatMode } from '@/stores/tab-store';
import { GenUISlot } from './GenUISlot';
import { useSystemChat } from '@/hooks/useSystemChat';
const USERS = [
  { name: 'Pepper Potts', image: '/images/user-2.jpg', online: true },
  { name: 'Tony Stark', image: '/images/user-1.jpg', online: true },
  { name: 'Happy Hogan', image: '/images/user-5.jpg', online: false },
];

const MODES: { key: ChatMode; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'trade', label: 'Trade' },
  { key: 'develop', label: 'Develop' },
];

export function OnliAiPanel() {
  const { chatMode, setChatMode } = useTabStore();
  useSystemChat();

  return (
    <div className="flex flex-col h-full">
      {/* User image card */}
      <div className="px-4 pb-2 pt-[20px]">
        <div className="rounded-[28px] border border-white/50 bg-[rgba(255,255,255,0.16)] p-3 shadow-[0_28px_60px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-[6px]">
          <div className="relative w-full overflow-hidden rounded-[22px] bg-[rgba(255,255,255,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" style={{ aspectRatio: '0.82' }}>
            <Image
              src="/images/user-portrait.jpg"
              alt="Alex Morgan"
              fill
              className="object-cover"
              sizes="248px"
            />
            {/* Top gradient */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_32%,rgba(0,0,0,0.05)_56%,rgba(0,0,0,0.42)_100%)]" />
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.18)_35%,rgba(0,0,0,0.52)_100%)]" />
            {/* Content overlay */}
            <div className="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[28px] leading-none font-normal tracking-[-0.07em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
                  Alex Morgan
                </h2>
                <p className="mt-1.5 text-[13px] tracking-[-0.03em] text-white/80">
                  Logged in
                </p>
              </div>
              <div className="shrink-0 w-3 h-3 rounded-full bg-[var(--color-accent-green)] border-2 border-white/40 shadow-[0_0_8px_rgba(0,200,0,0.4)]" />
            </div>
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

      {/* Users gallery — pinned bottom */}
      <div className="flex-shrink-0 border-t border-[var(--color-border)]">
        <p className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">
          People
        </p>
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
          {USERS.map((user) => (
            <div
              key={user.name}
              className="relative flex-shrink-0 w-[80px] h-[100px] rounded-[16px] overflow-hidden bg-[#F5F5F5] shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.image}
                alt={user.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-[50%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
              <div className="absolute bottom-1.5 left-2 right-2">
                <p className="text-[9px] font-semibold text-white leading-tight truncate">
                  {user.name}
                </p>
              </div>
              {user.online && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-accent-green)] border border-white/50 shadow-[0_0_4px_rgba(0,200,0,0.4)]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
