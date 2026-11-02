import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/**
 * 차트 요소 ↔ 표 행 연결(기획서 §8)을 위한 선택 상태. 문서가 아니므로 실행 취소 기록에 넣지 않는다.
 * - 차트에서 흐름·노드를 누르면 해당 행들을 선택
 * - 표의 셀에 초점이 가면 그 행을 선택
 */
export interface Selection {
  rowIds: string[];
  linkId?: string;
  nodeId?: string;
  from: 'chart' | 'table';
}

interface SelectionStore {
  selection: Selection | null;
  select(selection: Selection): void;
  clear(): void;
}

export const selectionStore = createStore<SelectionStore>()((set) => ({
  selection: null,
  select: (selection) => set({ selection }),
  clear: () => set({ selection: null }),
}));

export function useSelection<T>(selector: (s: SelectionStore) => T): T {
  return useStore(selectionStore, selector);
}
