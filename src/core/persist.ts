import { DEFAULT_SETTINGS, SCHEMA_VERSION, createRow } from './config';
import type { DiagramDoc, Row, Settings } from './types';

/**
 * 브라우저 임시 저장(F-07). 저장 위치는 이 기기·이 브라우저의 localStorage뿐이고 서버로 보내지 않는다.
 * DOM에 의존하지 않도록 Storage를 인자로 받는다.
 */
export const STORAGE_KEY = 'sankey-maker:autosave';

/** localStorage와 같은 최소 인터페이스 */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface Envelope {
  schemaVersion: number;
  savedAt: string;
  doc: unknown;
}

export type LoadResult =
  | { status: 'ok'; doc: DiagramDoc; savedAt: string }
  | { status: 'empty' }
  /** 저장된 내용을 읽을 수 없음(손상·알 수 없는 버전). 기존 값은 지우지 않는다. */
  | { status: 'invalid'; reason: string }
  | { status: 'unavailable' };

export type SaveResult =
  | { status: 'ok'; savedAt: string }
  /** 저장 공간이 꽉 참 */
  | { status: 'quota' }
  /** 사생활 보호 모드·차단 등으로 저장소를 쓸 수 없음 */
  | { status: 'unavailable' };

export function saveDoc(
  storage: KeyValueStorage | null,
  doc: DiagramDoc,
  now = new Date(),
): SaveResult {
  if (!storage) return { status: 'unavailable' };
  const savedAt = now.toISOString();
  const envelope: Envelope = { schemaVersion: SCHEMA_VERSION, savedAt, doc };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return { status: 'ok', savedAt };
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { status: 'quota' };
    }
    return { status: 'unavailable' };
  }
}

export function loadDoc(storage: KeyValueStorage | null): LoadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'JSON이 아닙니다.' };
  }
  if (!isObject(parsed)) return { status: 'invalid', reason: '형식이 다릅니다.' };
  const env = parsed as Partial<Envelope>;
  if (typeof env.schemaVersion !== 'number')
    return { status: 'invalid', reason: '버전이 없습니다.' };
  if (env.schemaVersion > SCHEMA_VERSION) {
    return { status: 'invalid', reason: '더 새로운 버전에서 저장한 내용입니다.' };
  }
  const doc = migrate(env.schemaVersion, env.doc);
  if (!doc) return { status: 'invalid', reason: '내용을 읽을 수 없습니다.' };
  return {
    status: 'ok',
    doc,
    savedAt: typeof env.savedAt === 'string' ? env.savedAt : doc.updatedAt,
  };
}

export function clearSaved(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}

/**
 * 저장 형식 변환. 버전이 올라가면 여기에 단계별 변환을 더한다(1 → 2 → …).
 * 지금은 v1 구조 검사와, 나중에 추가된 설정 항목을 기본값으로 채우는 일만 한다.
 */
function migrate(version: number, input: unknown): DiagramDoc | null {
  if (version !== 1 || !isObject(input)) return null;
  const d = input as Record<string, unknown>;
  if (!Array.isArray(d.rows) || !isObject(d.meta)) return null;

  const rows: Row[] = [];
  for (const r of d.rows) {
    if (!isObject(r)) return null;
    const row = r as Record<string, unknown>;
    const str = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
    rows.push({
      id: typeof row.id === 'string' && row.id ? row.id : createRow().id,
      source: str('source'),
      target: str('target'),
      value: str('value'),
      ...(typeof row.group === 'string' && { group: row.group }),
      ...(typeof row.memo === 'string' && { memo: row.memo }),
    });
  }

  const meta = d.meta as Record<string, unknown>;
  const text = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '');
  const saved = isObject(d.settings) ? (d.settings as Partial<Settings>) : {};

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title: text('title'), description: text('description'), unit: text('unit') },
    rows: rows.length > 0 ? rows : [createRow()],
    settings: mergeSettings(saved),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(),
  };
}

/** 알려진 항목만, 기본값과 같은 타입일 때만 가져온다. */
function mergeSettings(saved: Partial<Settings>): Settings {
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = (saved as Record<string, unknown>)[key];
    if (v === undefined || typeof v !== typeof def) continue;
    if (isObject(def)) {
      if (!isObject(v)) continue;
      out[key] =
        key === 'nodeColorOverrides'
          ? Object.fromEntries(
              Object.entries(v).filter(
                ([, c]) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c),
              ),
            )
          : { ...def, ...v };
    } else {
      out[key] = v;
    }
  }
  return out as unknown as Settings;
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
