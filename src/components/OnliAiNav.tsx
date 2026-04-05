'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTabStore, type ChatMode } from '@/stores/tab-store';

interface NavSection {
  key: string;
  icon: React.ReactNode;
  brand: string;
  label: string;
  mode?: ChatMode;
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'onli-syn',
    icon: (
      <span className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold">
        OS
      </span>
    ),
    brand: 'Onli Syn',
    label: 'Onli Ai Model',
  },
  {
    key: 'onli-cloud',
    icon: (
      <span className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L2 8l6 6 6-6-6-6z" stroke="var(--color-accent-green)" strokeWidth="1.5" fill="none" />
          <circle cx="8" cy="8" r="2" fill="var(--color-accent-green)" />
        </svg>
      </span>
    ),
    brand: 'Onli Cloud',
    label: 'Develop',
  },
  {
    key: 'onli-ai-create',
    icon: (
      <span className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L8 2l4 10" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 9h6" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    ),
    brand: 'Onli Ai',
    label: 'Create',
    mode: 'ask',
  },
  {
    key: 'onli-ai-learn',
    icon: (
      <span className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L8 2l4 10" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 9h6" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    ),
    brand: 'Onli Ai',
    label: 'Learn',
    mode: 'learn',
  },
  {
    key: 'niech-trade',
    icon: (
      <span className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L8 2l4 10" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 9h6" stroke="#7C7CFF" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    ),
    brand: 'Niech',
    label: 'Trade',
    mode: 'trade',
  },
];

export function OnliAiNav() {
  const { chatMode, setChatMode } = useTabStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleClick = (section: NavSection) => {
    if (section.mode) {
      setChatMode(section.mode);
    }
    setExpanded((prev) => (prev === section.key ? null : section.key));
  };

  return (
    <nav className="space-y-1">
      {NAV_SECTIONS.map((section) => {
        const isActive = section.mode === chatMode;
        const isExpanded = expanded === section.key;

        return (
          <div key={section.key}>
            <button
              onClick={() => handleClick(section)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-[var(--radius-button)] transition-all',
                isActive
                  ? 'bg-[var(--color-bg-card)]'
                  : 'hover:bg-[var(--color-bg-card)]/60',
              )}
            >
              {section.icon}
              <div className="flex-1 text-left">
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-none">
                  {section.brand}
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
                  {section.label}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={cn(
                  'transition-transform duration-200 text-[var(--color-text-secondary)]',
                  isExpanded && 'rotate-180',
                )}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Expandable sub-content */}
            {isExpanded && (
              <div className="ml-11 py-2 text-xs text-[var(--color-text-secondary)] animate-fade-in">
                {section.mode ? (
                  <p className="px-3 py-1.5">{section.label} mode active</p>
                ) : (
                  <p className="px-3 py-1.5">Coming soon</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
