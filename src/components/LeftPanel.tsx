'use client';

import { useTabStore } from '@/stores/tab-store';
import { ModeTabBar } from './ModeTabBar';

// Mode panels (will be created by other agents)
import { AdsPanel } from '@/features/ask/AdsPanel';
import { SettingsPanel } from '@/features/ask/SettingsPanel';
import { BlogsPanel } from '@/features/learn/BlogsPanel';
import { WhitepapersPanel } from '@/features/learn/WhitepapersPanel';
import { AccountPanel } from '@/features/trade/AccountPanel';
import { MarketPanel } from '@/features/trade/MarketPanel';

const MODE_TABS = {
  ask: [
    { key: 'ads', label: 'Ads' },
    { key: 'settings', label: 'Settings' },
  ],
  learn: [
    { key: 'blogs', label: 'Blogs' },
    { key: 'whitepapers', label: 'Whitepapers' },
  ],
  trade: [
    { key: 'account', label: 'Account' },
    { key: 'market', label: 'Market' },
  ],
} as const;

function PanelContent({ mode, tab }: { mode: string; tab: string }) {
  if (mode === 'ask') {
    if (tab === 'ads') return <AdsPanel />;
    if (tab === 'settings') return <SettingsPanel />;
  }
  if (mode === 'learn') {
    if (tab === 'blogs') return <BlogsPanel />;
    if (tab === 'whitepapers') return <WhitepapersPanel />;
  }
  if (mode === 'trade') {
    if (tab === 'account') return <AccountPanel />;
    if (tab === 'market') return <MarketPanel />;
  }
  return null;
}

export function LeftPanel() {
  const { chatMode, leftPanelTab, setLeftPanelTab } = useTabStore();
  const tabs = MODE_TABS[chatMode];

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <ModeTabBar
        tabs={[...tabs]}
        activeTab={leftPanelTab}
        onTabChange={setLeftPanelTab}
      />
      <div key={`${chatMode}-${leftPanelTab}`} className="left-panel-content">
        <PanelContent mode={chatMode} tab={leftPanelTab} />
      </div>
    </div>
  );
}
