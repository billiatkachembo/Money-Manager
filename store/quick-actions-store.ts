import { create } from 'zustand';

type QuickActionsState = {
  openAddTransactionAt: number | null;
  openTransactionSearchAt: number | null;
  triggerQuickAdd: () => void;
  triggerSearch: () => void;
  consumeQuickAdd: () => void;
  consumeSearch: () => void;
};

export const useQuickActionsStore = create<QuickActionsState>((set) => ({
  openAddTransactionAt: null,
  openTransactionSearchAt: null,
  triggerQuickAdd: () => set({ openAddTransactionAt: Date.now() }),
  triggerSearch: () => set({ openTransactionSearchAt: Date.now() }),
  consumeQuickAdd: () => set({ openAddTransactionAt: null }),
  consumeSearch: () => set({ openTransactionSearchAt: null }),
}));
