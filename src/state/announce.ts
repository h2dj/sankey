import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** 화면 아래에 잠깐 보이고 스크린리더가 읽는 알림(가져오기·내려받기 결과 등). */
interface AnnounceStore {
  message: string;
  /** 같은 문장을 다시 알릴 때도 읽히도록 바뀌는 값 */
  seq: number;
  announce(message: string): void;
  dismiss(): void;
}

export const announceStore = createStore<AnnounceStore>()((set) => ({
  message: '',
  seq: 0,
  announce: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  dismiss: () => set({ message: '' }),
}));

export const announce = (message: string) => announceStore.getState().announce(message);

export function useAnnounce<T>(selector: (s: AnnounceStore) => T): T {
  return useStore(announceStore, selector);
}
