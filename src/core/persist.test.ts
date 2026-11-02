import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './config';
import { STORAGE_KEY, clearSaved, loadDoc, saveDoc, type KeyValueStorage } from './persist';
import { loadSample } from './samples';

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const storage: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return { storage, data };
}

const throwing = (name: string): KeyValueStorage => ({
  getItem: () => {
    throw Object.assign(new Error(name), { name });
  },
  setItem: () => {
    throw Object.assign(new Error(name), { name });
  },
  removeItem: () => {
    throw Object.assign(new Error(name), { name });
  },
});

describe('persist', () => {
  it('저장한 문서를 그대로 불러온다', () => {
    const { storage } = memoryStorage();
    const doc = loadSample('energy');
    doc.settings.nodeColorOverrides = { 발전: '#123456' };
    const saved = saveDoc(storage, doc, new Date('2026-11-02T01:02:03Z'));
    expect(saved).toEqual({ status: 'ok', savedAt: '2026-11-02T01:02:03.000Z' });
    const loaded = loadDoc(storage);
    expect(loaded).toEqual({ status: 'ok', doc, savedAt: '2026-11-02T01:02:03.000Z' });
  });

  it('저장된 것이 없으면 empty, 저장소가 없으면 unavailable', () => {
    expect(loadDoc(memoryStorage().storage)).toEqual({ status: 'empty' });
    expect(loadDoc(null)).toEqual({ status: 'unavailable' });
    expect(saveDoc(null, loadSample('budget'))).toEqual({ status: 'unavailable' });
  });

  it('저장 공간 부족·저장소 차단을 구분한다', () => {
    expect(saveDoc(throwing('QuotaExceededError'), loadSample('budget'))).toEqual({
      status: 'quota',
    });
    expect(saveDoc(throwing('SecurityError'), loadSample('budget'))).toEqual({
      status: 'unavailable',
    });
    expect(loadDoc(throwing('SecurityError'))).toEqual({ status: 'unavailable' });
    expect(() => clearSaved(throwing('SecurityError'))).not.toThrow();
  });

  it.each([
    ['JSON이 아님', '{not json'],
    ['배열', '[]'],
    ['버전 없음', '{"doc":{}}'],
    ['새 버전', '{"schemaVersion":99,"doc":{}}'],
    ['rows 없음', '{"schemaVersion":1,"doc":{"meta":{}}}'],
    ['행이 객체가 아님', '{"schemaVersion":1,"doc":{"meta":{},"rows":[1]}}'],
  ])('손상된 저장값(%s)은 invalid', (_, raw) => {
    const { storage, data } = memoryStorage({ [STORAGE_KEY]: raw });
    expect(loadDoc(storage).status).toBe('invalid');
    // 읽지 못했다고 지우지는 않는다(사용자가 다른 버전 앱에서 다시 열 수 있도록)
    expect(data.has(STORAGE_KEY)).toBe(true);
  });

  it('빠진 설정은 기본값으로, 타입이 틀린 값과 잘못된 색은 버린다', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      savedAt: 'x',
      doc: {
        meta: { title: 'T', unit: 5 },
        rows: [{ source: 'A', target: 'B', value: '1', group: 3 }, {}],
        settings: {
          fontSize: '20',
          nodeWidth: 30,
          numberFormat: { decimals: 1 },
          nodeColorOverrides: { A: '#abcdef', B: 'red' },
          unknownSetting: true,
        },
      },
    });
    const res = loadDoc(memoryStorage({ [STORAGE_KEY]: raw }).storage);
    if (res.status !== 'ok') throw new Error(res.status);
    expect(res.doc.meta).toEqual({ title: 'T', description: '', unit: '' });
    expect(res.doc.rows).toHaveLength(2);
    expect(res.doc.rows[0]).toMatchObject({ source: 'A', target: 'B', value: '1' });
    expect(res.doc.rows[0]!.group).toBeUndefined();
    expect(res.doc.rows[0]!.id).toBeTruthy();
    expect(res.doc.settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(res.doc.settings.nodeWidth).toBe(30);
    expect(res.doc.settings.numberFormat).toEqual({ decimals: 1, thousands: true });
    expect(res.doc.settings.nodeColorOverrides).toEqual({ A: '#abcdef' });
    expect(res.doc.settings).not.toHaveProperty('unknownSetting');
  });

  it('빈 행 목록이면 빈 행 하나', () => {
    const raw = JSON.stringify({ schemaVersion: 1, doc: { meta: {}, rows: [] } });
    const res = loadDoc(memoryStorage({ [STORAGE_KEY]: raw }).storage);
    expect(res.status === 'ok' && res.doc.rows.length).toBe(1);
  });

  it('clearSaved', () => {
    const { storage, data } = memoryStorage();
    saveDoc(storage, loadSample('budget'));
    clearSaved(storage);
    expect(data.size).toBe(0);
  });

  it('시기 설정을 검사해 불러온다', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      doc: {
        meta: {},
        rows: [],
        settings: {
          timeline: {
            enabled: true,
            periods: [
              { id: 'a', label: '2018' },
              { id: 'a', label: '중복' },
              { label: 'id 없음' },
              3,
            ],
            nodePeriods: { X: 'a', Y: 'missing', Z: 5 },
            showTotals: 'yes',
          },
        },
      },
    });
    const res = loadDoc(memoryStorage({ [STORAGE_KEY]: raw }).storage);
    if (res.status !== 'ok') throw new Error(res.status);
    expect(res.doc.settings.timeline).toEqual({
      enabled: true,
      periods: [{ id: 'a', label: '2018' }],
      nodePeriods: { X: 'a' },
      showBands: true,
      showTotals: false,
    });
  });

  it('예전 저장값(시기 설정 없음)은 시기 모드 꺼짐', () => {
    const raw = JSON.stringify({ schemaVersion: 1, doc: { meta: {}, rows: [], settings: {} } });
    const res = loadDoc(memoryStorage({ [STORAGE_KEY]: raw }).storage);
    expect(res.status === 'ok' && res.doc.settings.timeline).toEqual(DEFAULT_SETTINGS.timeline);
  });
});
