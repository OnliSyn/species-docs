import { create } from 'zustand';

type ActiveTab = 'neich' | 'species';
type BalanceView = 'funding' | 'asset';
type ChatMode = 'ask' | 'trade' | 'learn';

interface TabStore {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  balanceView: BalanceView;
  setBalanceView: (view: BalanceView) => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  activeTab: 'neich',
  setActiveTab: (activeTab) => set({ activeTab }),
  balanceView: 'funding',
  setBalanceView: (balanceView) => set({ balanceView }),
  chatMode: 'ask',
  setChatMode: (chatMode) => set({ chatMode }),
}));
