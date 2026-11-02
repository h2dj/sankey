import { loadDoc, type KeyValueStorage, type LoadResult } from '../core/persist';
import { DEFAULT_SAMPLE_ID, loadSample } from '../core/samples';
import type { DiagramDoc } from '../core/types';

/** 쓸 수 있는 localStorage. 사생활 보호 모드·차단·Node 환경이면 null */
export function browserStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__sankey_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface InitialDoc {
  doc: DiagramDoc;
  /** 저장소에서 불러온 결과 */
  load: LoadResult;
}

/** 저장된 작업이 있으면 그것을, 없거나 읽을 수 없으면 기본 예시로 시작한다. */
export function initialDoc(storage = browserStorage()): InitialDoc {
  const load = loadDoc(storage);
  return { doc: load.status === 'ok' ? load.doc : loadSample(DEFAULT_SAMPLE_ID), load };
}
