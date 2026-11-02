import { describe, expect, it } from 'vitest';
import { DEFAULT_SAMPLE_ID, SAMPLES, loadSample } from './samples';

describe('samples', () => {
  it('기획서 §3 사용 사례 4종을 제공한다', () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(['budget', 'energy', 'program', 'survey']);
    expect(SAMPLES.some((s) => s.id === DEFAULT_SAMPLE_ID)).toBe(true);
  });

  it.each(SAMPLES.map((s) => s.id))('%s: 모든 행이 기본 입력 규칙을 만족한다', (id) => {
    const doc = loadSample(id);
    expect(doc.meta.title).not.toBe('');
    expect(doc.meta.unit).not.toBe('');
    expect(doc.rows.length).toBeGreaterThan(0);
    for (const row of doc.rows) {
      expect(row.source.trim()).not.toBe('');
      expect(row.target.trim()).not.toBe('');
      expect(row.source).not.toBe(row.target);
      const v = Number(row.value);
      expect(Number.isFinite(v) && v > 0).toBe(true);
    }
  });

  it.each(SAMPLES.map((s) => s.id))('%s: 중간 노드의 유입과 유출이 같다', (id) => {
    const { rows } = loadSample(id);
    const inflow = new Map<string, number>();
    const outflow = new Map<string, number>();
    for (const r of rows) {
      outflow.set(r.source, (outflow.get(r.source) ?? 0) + Number(r.value));
      inflow.set(r.target, (inflow.get(r.target) ?? 0) + Number(r.value));
    }
    for (const [node, out] of outflow) {
      if (inflow.has(node)) expect(inflow.get(node), node).toBe(out);
    }
  });

  it('부를 때마다 새 행 ID를 발급한다', () => {
    const a = loadSample('budget');
    const b = loadSample('budget');
    const ids = new Set([...a.rows, ...b.rows].map((r) => r.id));
    expect(ids.size).toBe(a.rows.length + b.rows.length);
  });

  it('없는 예시는 오류', () => {
    expect(() => loadSample('nope')).toThrow();
  });
});
