import { create } from 'zustand';

export type AppTab =
  | 'home'
  | 'transactions'
  | 'analytics'
  | 'profile'
  | 'calendar'
  | 'accounts'
  | 'notes'
  | 'planning';

type TabNavigationState = {
  activeTab: AppTab;
  openAccountComposerAt: number | null;
  openNoteComposerAt: number | null;
  setActiveTab: (tab: AppTab) => void;
  openAccountsComposer: () => void;
  consumeAccountsComposer: () => void;
  openNotesComposer: () => void;
  consumeNotesComposer: () => void;
};

export const useTabNavigationStore = create<TabNavigationState>((set) => ({
  activeTab: 'home',
  openAccountComposerAt: null,
  openNoteComposerAt: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  openAccountsComposer: () =>
    set({
      activeTab: 'accounts',
      openAccountComposerAt: Date.now(),
    }),
  consumeAccountsComposer: () => set({ openAccountComposerAt: null }),
  openNotesComposer: () =>
    set({
      activeTab: 'notes',
      openNoteComposerAt: Date.now(),
    }),
  consumeNotesComposer: () => set({ openNoteComposerAt: null }),
}));