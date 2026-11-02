import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { LIMITS } from '../core/config';
import { saveDoc, type KeyValueStorage, type LoadResult } from '../core/persist';
import { editorStore } from './store';

export type SaveState =
  | { kind: 'idle'; restoredAt?: string }
  | { kind: 'pending' }
  | { kind: 'saved'; savedAt: string }
  | { kind: 'error'; reason: 'quota' | 'unavailable' };

export const saveStateStore = createStore<{ state: SaveState }>()(() => ({
  state: { kind: 'idle' },
}));

export function useSaveState(): SaveState {
  return useStore(saveStateStore, (s) => s.state);
}

/**
 * 문서가 바뀌면 잠시 뒤 localStorage에 저장한다. 탭을 숨기거나 닫을 때는 바로 저장한다.
 * 정리 함수를 돌려준다.
 */
export function startAutosave(storage: KeyValueStorage | null, load: LoadResult): () => void {
  const set = (state: SaveState) => saveStateStore.setState({ state });
  if (!storage) set({ kind: 'error', reason: 'unavailable' });
  else if (load.status === 'ok') set({ kind: 'idle', restoredAt: load.savedAt });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!dirty) return;
    dirty = false;
    const res = saveDoc(storage, editorStore.getState().doc);
    set(
      res.status === 'ok'
        ? { kind: 'saved', savedAt: res.savedAt }
        : { kind: 'error', reason: res.status },
    );
  };

  const unsubscribe = editorStore.subscribe((s, prev) => {
    if (s.doc === prev.doc) return;
    dirty = true;
    if (saveStateStore.getState().state.kind !== 'error') set({ kind: 'pending' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, LIMITS.autosaveDelayMs);
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onHide);
  };
}
