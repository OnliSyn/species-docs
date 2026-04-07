'use client';

import { create } from 'zustand';

type ChatMode = 'ask' | 'trade' | 'develop';
type BalanceView = 'funding' | 'asset';
type FundWizardStep = 1 | 2 | 3 | 4;
type RightPanelTab = 'info' | 'canvas' | 'blog';

// Left panel sub-tabs per mode
const DEFAULT_TAB: Record<ChatMode, string> = {
  ask: 'ads',
  trade: 'account',
  develop: 'blogs',
};

interface TabStore {
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  leftPanelTab: string;
  setLeftPanelTab: (tab: string) => void;

  balanceView: BalanceView;
  setBalanceView: (view: BalanceView) => void;

  fundWizardStep: FundWizardStep;
  setFundWizardStep: (step: FundWizardStep) => void;
  resetFundWizard: () => void;

  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;

  chatLocked: boolean;
  setChatLocked: (locked: boolean) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  chatMode: 'ask',
  setChatMode: (chatMode) => set({
    chatMode,
    leftPanelTab: DEFAULT_TAB[chatMode],
    rightPanelTab: chatMode === 'develop' ? 'canvas' : 'info',
    fundWizardStep: 1,
  }),

  leftPanelTab: 'ads',
  setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),

  balanceView: 'funding',
  setBalanceView: (balanceView) => set({ balanceView }),

  fundWizardStep: 1,
  setFundWizardStep: (fundWizardStep) => set({ fundWizardStep }),
  resetFundWizard: () => set({ fundWizardStep: 1 }),

  rightPanelTab: 'info',
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),

  chatLocked: false,
  setChatLocked: (chatLocked) => set({ chatLocked }),
}));

export type { ChatMode, BalanceView, FundWizardStep, RightPanelTab };
