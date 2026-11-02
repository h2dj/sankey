import type { DiagramDoc, DiagramMeta, Row, Settings } from './types';

/**
 * 개발 계획 §2.2 잠정값. 사용자 검토(S5) 전까지 여기서만 바꾼다.
 */
export const LIMITS = {
  /** 이 행 수를 넘으면 입력을 막는다. T1.6 측정 후 확정. */
  maxRows: 500,
  /** 이 행 수를 넘으면 느려질 수 있다고 안내한다. */
  warnRows: 200,
  /** 입력 후 다시 그리기까지 기다리는 시간(ms) */
  renderDebounceMs: 150,
  /** 자동 저장 지연(ms) */
  autosaveDelayMs: 1000,
} as const;

export const SCHEMA_VERSION = 1 as const;

export const DEFAULT_SETTINGS: Settings = {
  direction: 'ltr',
  nodeAlign: 'justify',
  nodeWidth: 16,
  nodePadding: 16,
  minLinkWidth: 1,
  fontSize: 13,
  showValues: true,
  labelPosition: 'inside',
  paletteId: 'default',
  colorMode: 'node',
  linkColor: 'source',
  nodeColorOverrides: {},
  duplicateMode: 'merge',
  numberFormat: { decimals: 'auto', thousands: true },
};

export const EMPTY_META: DiagramMeta = { title: '', description: '', unit: '' };

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function createRow(partial: Omit<Partial<Row>, 'id'> = {}): Row {
  return { id: newId(), source: '', target: '', value: '', ...partial };
}

export function createDoc(init: { meta?: Partial<DiagramMeta>; rows?: Row[] } = {}): DiagramDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { ...EMPTY_META, ...init.meta },
    rows: init.rows ?? [createRow()],
    settings: structuredClone(DEFAULT_SETTINGS),
    updatedAt: new Date().toISOString(),
  };
}
