import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { buildChartModel } from './chartModel';
import { DEFAULT_SETTINGS } from './config';
import { CSV_BOM, parseCsv, recordsToRows, serializeCsv } from './csv';
import { STORAGE_KEY, loadDoc, sanitizeNotes, saveDoc } from './persist';
import { loadSample } from './samples';
import { renderSvgDocument } from './svgDocument';
import type { Settings } from './types';

const doc = () => loadSample('budget');
const notes = { 교육: '강사비 포함', 홍보: '온라인 위주', 없는노드: '그려지지 않음' };

function model(noteDisplay: Settings['noteDisplay'], n: Record<string, string> = notes) {
  const d = doc();
  const s = { ...DEFAULT_SETTINGS, noteDisplay };
  return buildChartModel(buildGraph(d.rows, s), d.rows, d.meta, s, 960, n);
}
const node = (m: ReturnType<typeof model>, id: string) => m.nodes.find((x) => x.id === id)!;

describe('노드 메모: 차트 모델', () => {
  it('툴팁 모드: 메모만 붙고 번호·줄은 없다', () => {
    const m = model('tooltip');
    expect(node(m, '교육')).toMatchObject({ note: '강사비 포함' });
    expect(node(m, '교육').noteMark).toBeUndefined();
    expect(node(m, '교육').noteLines).toBeUndefined();
    expect(node(m, '운영').note).toBeUndefined();
    expect(m.footnotes).toEqual([]);
  });

  it('각주 모드: 읽는 순서(왼쪽 열 → 위)로 번호, 그려지지 않는 노드는 빠진다', () => {
    const m = model('footnote');
    expect(m.footnotes.map((f) => [f.mark, f.label, f.text])).toEqual([
      ['[1]', '교육', '강사비 포함'],
      ['[2]', '홍보', '온라인 위주'],
    ]);
    expect(node(m, '교육').noteMark).toBe('[1]');
  });

  it('레이블 아래 모드: 긴 메모는 두 줄로 줄이고 말줄임', () => {
    const long = '아주 긴 메모 '.repeat(20);
    const m = model('below', { 교육: long, 홍보: '짧음' });
    const lines = node(m, '교육').noteLines!;
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    expect(node(m, '홍보').noteLines).toEqual(['짧음']);
  });

  it('공백뿐인 메모는 없는 것으로 본다', () => {
    expect(node(model('footnote', { 교육: '   ' }), '교육').note).toBeUndefined();
  });
});

describe('노드 메모: 내보내기 SVG', () => {
  const opts = {
    title: 'T',
    description: '',
    unit: '',
    settings: DEFAULT_SETTINGS,
    includeHeader: true,
    background: '#ffffff',
  };

  it('각주 모드: 레이블 번호와 차트 아래 목록', () => {
    const m = model('footnote');
    const { svg, height } = renderSvgDocument(m, opts);
    expect(svg).toContain('font-weight="600"> [1]</tspan>');
    expect(svg).toContain('>[1] 교육 — 강사비 포함</text>');
    expect(svg).toContain('>[2] 홍보 — 온라인 위주</text>');
    const plain = renderSvgDocument(model('tooltip'), opts);
    expect(height).toBeGreaterThan(plain.height);
    expect(plain.svg).not.toContain('강사비 포함</text>');
  });

  it('레이블 아래 모드: 노드 레이블 아래 메모 줄', () => {
    const { svg } = renderSvgDocument(model('below'), opts);
    expect(svg).toMatch(/fill="#57606A">강사비 포함<\/text>/);
  });
});

describe('노드 메모: CSV', () => {
  it('메모가 있으면 출발·도착 노드 메모 열을 내보내고 다시 읽는다', () => {
    const d = doc();
    const out = serializeCsv(d.rows, '', undefined, notes);
    const lines = out.replace(CSV_BOM, '').trim().split('\r\n');
    expect(lines[0]).toBe('출발 노드,도착 노드,값,색상 그룹,메모,출발 노드 메모,도착 노드 메모');
    expect(lines[1]).toBe('전체 예산,교육,40,사업 분야,,,강사비 포함');
    expect(lines[5]).toBe('교육,강사비,25,세부 항목,외부 강사 포함,강사비 포함,');

    const res = parseCsv(new TextEncoder().encode(out));
    if (!res.ok) throw new Error(res.error);
    expect(res.csv.mapping).toMatchObject({ sourceNote: 5, targetNote: 6 });
    const back = recordsToRows(res.csv, res.csv.mapping, true);
    expect(Object.fromEntries(back.nodeNotes)).toEqual({
      교육: '강사비 포함',
      홍보: '온라인 위주',
    });
  });

  it('메모가 없으면 열을 더하지 않는다', () => {
    expect(serializeCsv(doc().rows, '', undefined, { 없는노드: 'x' })).not.toContain('노드 메모');
  });
});

describe('노드 메모: 저장 형식', () => {
  it('문자열만, 앞뒤 공백 제거, 빈 메모 제외, 최대 500자', () => {
    expect(sanitizeNotes({ A: ' 메모 ', B: '', C: 3, D: 'x'.repeat(600), '': 'y' })).toEqual({
      A: '메모',
      D: 'x'.repeat(500),
    });
    expect(sanitizeNotes(null)).toEqual({});
  });

  it('저장·불러오기 왕복, 예전 저장값은 빈 메모', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    const d = { ...doc(), nodeNotes: { 교육: '강사비' } };
    saveDoc(storage, d);
    const res = loadDoc(storage);
    expect(res.status === 'ok' && res.doc.nodeNotes).toEqual({ 교육: '강사비' });

    data.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, doc: { meta: {}, rows: [] } }));
    const old = loadDoc(storage);
    expect(old.status === 'ok' && old.doc.nodeNotes).toEqual({});
  });

  it('잘못된 표시 방식 값은 기본값으로', () => {
    const data = new Map([
      [
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 1,
          doc: { meta: {}, rows: [], settings: { noteDisplay: 'popup' } },
        }),
      ],
    ]);
    const res = loadDoc({
      getItem: (k) => data.get(k) ?? null,
      setItem: () => {},
      removeItem: () => {},
    });
    expect(res.status === 'ok' && res.doc.settings.noteDisplay).toBe('tooltip');
  });
});
