import { create } from 'zustand';

export type AppTooltipTone = 'info' | 'success' | 'warning' | 'error';

export interface AppTooltipInput {
  title?: string;
  message?: string;
  tone?: AppTooltipTone;
  durationMs?: number;
}

export interface AppTooltipItem {
  id: number;
  title?: string;
  message: string;
  tone: AppTooltipTone;
  durationMs: number;
}

type AppTooltipState = {
  nextId: number;
  current: AppTooltipItem | null;
  queue: AppTooltipItem[];
  showTooltip: (input: AppTooltipInput) => void;
  dismissTooltip: () => void;
  clearTooltips: () => void;
};

const resolveDuration = (message: string, tone: AppTooltipTone, durationMs?: number) => {
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) {
    return durationMs;
  }

  const baseDuration = tone === 'error' || tone === 'warning' ? 3200 : 2400;
  const contentBonus = Math.min(2200, Math.max(0, message.length * 18));
  return baseDuration + contentBonus;
};

const normalizeTooltip = (nextId: number, input: AppTooltipInput): AppTooltipItem => {
  const rawTitle = (input.title ?? '').trim();
  const rawMessage = (input.message ?? '').trim();
  const message = rawMessage || rawTitle || 'Update';
  const title = rawMessage && rawTitle && rawTitle !== rawMessage ? rawTitle : undefined;
  const tone = input.tone ?? 'info';

  return {
    id: nextId,
    title,
    message,
    tone,
    durationMs: resolveDuration(message, tone, input.durationMs),
  };
};

export const useAppTooltipStore = create<AppTooltipState>((set, get) => ({
  nextId: 1,
  current: null,
  queue: [],
  showTooltip: (input) => {
    const item = normalizeTooltip(get().nextId, input);
    const { current, queue } = get();

    if (current) {
      set({
        nextId: item.id + 1,
        queue: [...queue, item],
      });
      return;
    }

    set({
      nextId: item.id + 1,
      current: item,
    });
  },
  dismissTooltip: () => {
    const { queue } = get();

    if (queue.length === 0) {
      set({ current: null });
      return;
    }

    const [next, ...rest] = queue;
    set({
      current: next,
      queue: rest,
    });
  },
  clearTooltips: () => set({ current: null, queue: [] }),
}));

export const showAppTooltip = (input: AppTooltipInput) => {
  useAppTooltipStore.getState().showTooltip(input);
};
