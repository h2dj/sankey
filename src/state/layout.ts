import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type PanelTab = 'data' | 'preview' | 'settings';

/** 좁은 화면(탭 배치)에서 지금 보이는 패널 */
export const layoutStore = createStore<{ tab: PanelTab; setTab(tab: PanelTab): void }>()((set) => ({
  tab: 'data',
  setTab: (tab) => set({ tab }),
}));

export function useLayout<T>(selector: (s: { tab: PanelTab; setTab(tab: PanelTab): void }) => T) {
  return useStore(layoutStore, selector);
}
