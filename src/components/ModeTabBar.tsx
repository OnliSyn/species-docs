'use client';

import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
}

interface ModeTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function ModeTabBar({ tabs, activeTab, onTabChange }: ModeTabBarProps) {
  return (
    <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`left-tab-${tab.key}`}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-semibold rounded-[var(--radius-input)] transition-all',
            activeTab === tab.key
              ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
