'use client';

import { cn } from '@/lib/utils';
import { InfoTab } from './right-panel/InfoTab';
import { CanvasTab } from './right-panel/CanvasTab';
import { useTabStore } from '@/stores/tab-store';
import { BlogTab } from './right-panel/BlogTab';
import type { RightPanelTab } from '@/stores/tab-store';

const TAB_LABELS: Record<string, Record<RightPanelTab, string>> = {
  ask:     { info: 'Info', canvas: 'Canvas', blog: 'Blog' },
  trade:   { info: 'Info', canvas: 'Canvas', blog: 'News' },
  develop: { info: 'Info', canvas: 'Canvas', blog: 'Whitepapers' },
};

const TAB_KEYS: RightPanelTab[] = ['info', 'canvas', 'blog'];

export function RightPanel() {
  const activeTab = useTabStore((s) => s.rightPanelTab);
  const setActiveTab = useTabStore((s) => s.setRightPanelTab);
  const chatMode = useTabStore((s) => s.chatMode);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] rounded-[var(--radius-button)]">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-input)] transition-all',
                activeTab === key
                  ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {(TAB_LABELS[chatMode] || TAB_LABELS.ask)[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className={`flex-1 min-h-0 px-4 pb-4 ${activeTab === 'canvas' && (chatMode === 'trade' || chatMode === 'develop') ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {activeTab === 'info' && <InfoTab mode={chatMode} />}
        {activeTab === 'canvas' && <CanvasTab mode={chatMode} />}
        {activeTab === 'blog' && <BlogTab mode={chatMode} />}
      </div>
    </div>
  );
}
