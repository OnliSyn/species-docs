'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { InfoTab } from './right-panel/InfoTab';
import { CanvasTab } from './right-panel/CanvasTab';
import { BlogTab } from './right-panel/BlogTab';

type Tab = 'info' | 'canvas' | 'blog';

const TABS: { key: Tab; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'canvas', label: 'Canvas' },
  { key: 'blog', label: 'Blog' },
];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('info');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-input)] transition-all',
                activeTab === tab.key
                  ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeTab === 'info' && <InfoTab />}
        {activeTab === 'canvas' && <CanvasTab />}
        {activeTab === 'blog' && <BlogTab />}
      </div>
    </div>
  );
}
