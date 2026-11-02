import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  appendEvent,
  sanitizeProps,
  type ObserveEvent,
  type ObserveEventName,
} from '../core/observe';

/**
 * 관찰 모드(사용성 테스트용). 주소에 ?observe=1을 붙이면 켜지고 ?observe=0이면 꺼진다.
 * 기록은 이 탭의 sessionStorage에만 두며 서버로 보내지 않는다. 진행자가 "기록 내려받기"로 파일을 받는다.
 * 나중에 운영 지표 도구를 붙일 때도 track() 호출 지점을 그대로 쓴다.
 */
const FLAG_KEY = 'sankey-maker:observe';
const LOG_KEY = 'sankey-maker:observe-log';

interface ObserveState {
  enabled: boolean;
  /** 관찰 시작 시각(epoch ms) */
  startedAt: number;
  events: ObserveEvent[];
}

function session(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function initialState(): ObserveState {
  const fresh = (enabled: boolean): ObserveState => ({
    enabled,
    startedAt: Date.now(),
    events: [],
  });
  const s = session();
  try {
    const param = new URLSearchParams(globalThis.location?.search ?? '').get('observe');
    if (param === '1') s?.setItem(FLAG_KEY, '1');
    if (param === '0') {
      s?.removeItem(FLAG_KEY);
      s?.removeItem(LOG_KEY);
    }
    if (s?.getItem(FLAG_KEY) !== '1') return fresh(false);
    const saved = JSON.parse(s.getItem(LOG_KEY) ?? 'null') as ObserveState | null;
    return saved && Array.isArray(saved.events) ? { ...saved, enabled: true } : fresh(true);
  } catch {
    // 저장소를 쓸 수 없으면 관찰 모드도 끈다.
    return fresh(false);
  }
}

export const observeStore = createStore<ObserveState>()(() => initialState());

function persist(state: ObserveState) {
  try {
    session()?.setItem(LOG_KEY, JSON.stringify(state));
  } catch {
    // 기록 저장 실패는 앱 동작에 영향을 주지 않는다.
  }
}

/** 관찰 모드가 꺼져 있으면 아무 일도 하지 않는다. props의 내용성 값은 버린다. */
export function track(name: ObserveEventName, props?: Record<string, unknown>): void {
  const state = observeStore.getState();
  if (!state.enabled) return;
  const clean = sanitizeProps(props);
  const event: ObserveEvent = {
    t: Date.now() - state.startedAt,
    name,
    ...(clean && { props: clean }),
  };
  const next = { ...state, events: appendEvent(state.events, event) };
  observeStore.setState(next);
  persist(next);
}

export function clearObservation(): void {
  const next = { enabled: true, startedAt: Date.now(), events: [] };
  observeStore.setState(next);
  persist(next);
  track('session_start');
}

export function stopObservation(): void {
  const s = session();
  s?.removeItem(FLAG_KEY);
  s?.removeItem(LOG_KEY);
  observeStore.setState({ enabled: false, events: [] });
}

export function useObserve<T>(selector: (s: ObserveState) => T): T {
  return useStore(observeStore, selector);
}
