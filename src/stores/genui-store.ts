import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Gen-UI Card extracted from chat tool results
// ---------------------------------------------------------------------------
export interface GenUICard {
  id: string;          // toolCallId — dedup key
  ui: string;          // _ui registry key (e.g. 'BalanceCard', 'PipelineCard')
  data: Record<string, unknown>;
  toolName: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Pending confirmation for write-tool results
// ---------------------------------------------------------------------------
export interface PendingConfirmation {
  id: string;          // toolCallId
  toolName: string;
  input: Record<string, unknown>;
  onResolve: (approved: boolean) => void;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface GenUIState {
  cards: GenUICard[];
  confirmations: PendingConfirmation[];

  pushCard: (card: GenUICard) => void;
  pushConfirmation: (conf: PendingConfirmation) => void;
  resolveConfirmation: (id: string) => void;
  clearAll: () => void;
}

export const useGenUIStore = create<GenUIState>((set) => ({
  cards: [],
  confirmations: [],

  pushCard: (card) =>
    set((s) => {
      // Dedup by id
      if (s.cards.some((c) => c.id === card.id)) return s;
      return { cards: [...s.cards, card] };
    }),

  pushConfirmation: (conf) =>
    set((s) => {
      if (s.confirmations.some((c) => c.id === conf.id)) return s;
      return { confirmations: [...s.confirmations, conf] };
    }),

  resolveConfirmation: (id) =>
    set((s) => ({
      confirmations: s.confirmations.filter((c) => c.id !== id),
    })),

  clearAll: () => set({ cards: [], confirmations: [] }),
}));
