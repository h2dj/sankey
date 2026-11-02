import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { buildChartModel } from './chartModel';
import { DEFAULT_SETTINGS } from './config';
import { NEUTRAL_LINK_COLOR, PALETTES } from './palette';
import { loadSample } from './samples';
import { estimateTextWidth } from './text';
import type { Settings } from './types';

function model(patch: Partial<Settings> = {}, sample = 'budget') {
  const doc = loadSample(sample);
  const settings = { ...DEFAULT_SETTINGS, ...patch };
  const graph = buildGraph(doc.rows, settings);
  return { doc, m: buildChartModel(graph, doc.rows, doc.meta, settings) };
}

const node = (m: ReturnType<typeof model>['m'], id: string) => m.nodes.find((n) => n.id === id)!;

describe('buildChartModel', () => {
  it('노드 표시값·레이블 위치(inside: 왼쪽 절반은 오른쪽에)', () => {
    const { m } = model();
    const root = node(m, '전체 예산');
    expect(root.valueText).toBe('100 백만 원');
    expect(root.labelAnchor).toBe('start');
    expect(root.labelX).toBeCloseTo(root.x1 + 6);
    const leaf = node(m, '인쇄물');
    expect(leaf.labelAnchor).toBe('end');
    expect(leaf.labelX).toBeCloseTo(leaf.x0 - 6);
  });

  it('outside: 양끝 열 레이블을 바깥에 두고 그만큼 여백을 잡는다', () => {
    const { m } = model({ labelPosition: 'outside' });
    const root = node(m, '전체 예산');
    expect(root.labelAnchor).toBe('end');
    const needed = estimateTextWidth('전체 예산 100 백만 원', DEFAULT_SETTINGS.fontSize);
    expect(root.x0).toBeGreaterThanOrEqual(needed);
    const leaf = node(m, '인쇄물');
    expect(leaf.labelAnchor).toBe('start');
    expect(m.width - leaf.x1).toBeGreaterThanOrEqual(
      estimateTextWidth('인쇄물 8 백만 원', DEFAULT_SETTINGS.fontSize),
    );
    // 가운데 열은 기존 규칙
    expect(node(m, '교육').labelAnchor).toBe('start');
  });

  it('값 표시를 끄면 valueText는 남지만 여백 계산에서 빠진다', () => {
    const on = model({ labelPosition: 'outside' }).m;
    const off = model({ labelPosition: 'outside', showValues: false }).m;
    expect(node(off, '전체 예산').x0).toBeLessThan(node(on, '전체 예산').x0);
  });

  it('노드 rowIds는 닿는 흐름의 행을 입력 순서로', () => {
    const { m, doc } = model();
    const ids = doc.rows.map((r) => r.id);
    // 교육: 1행(전체 예산→교육), 5행, 6행
    expect(node(m, '교육').rowIds).toEqual([ids[0], ids[4], ids[5]]);
  });

  it('흐름 비율과 표시 문자열', () => {
    const { m } = model();
    const link = m.links.find((l) => l.source === '교육' && l.target === '강사비')!;
    expect(link.shareOfSource).toBeCloseTo(25 / 40);
    expect(link.valueText).toBe('25 백만 원');
    expect([link.sourceLabel, link.targetLabel]).toEqual(['교육', '강사비']);
  });

  describe('색상', () => {
    it('팔레트 색을 입력 순서대로 배정', () => {
      const { m } = model({ paletteId: 'earth' });
      const earth = PALETTES.find((p) => p.id === 'earth')!.colors;
      expect(node(m, '전체 예산').color).toBe(earth[0]);
      expect(node(m, '교육').color).toBe(earth[1]);
    });

    it('흐름 색: 출발/도착/회색, 그라데이션은 양끝 색을 가진다', () => {
      const pick = (p: Partial<Settings>) =>
        model(p).m.links.find((l) => l.source === '전체 예산' && l.target === '교육')!;
      const root = node(model().m, '전체 예산').color;
      const edu = node(model().m, '교육').color;
      expect(pick({ linkColor: 'source' }).color).toBe(root);
      expect(pick({ linkColor: 'target' }).color).toBe(edu);
      expect(pick({ linkColor: 'neutral' }).color).toBe(NEUTRAL_LINK_COLOR);
      const g = pick({ linkColor: 'gradient' });
      expect([g.sourceColor, g.targetColor]).toEqual([root, edu]);
    });

    it('색상 그룹 기준: 같은 그룹은 같은 색', () => {
      const { m } = model({ colorMode: 'group' });
      expect(node(m, '교육').color).toBe(node(m, '운영').color);
      expect(node(m, '강사비').color).toBe(node(m, '인쇄물').color);
      expect(node(m, '교육').color).not.toBe(node(m, '강사비').color);
    });

    it('직접 지정한 색이 우선', () => {
      const { m } = model({ nodeColorOverrides: { 교육: '#123456' } });
      expect(node(m, '교육').color).toBe('#123456');
    });

    it('앞 행이 오류로 빠져도 다른 노드의 색은 그대로', () => {
      const doc = loadSample('budget');
      const before = buildChartModel(
        buildGraph(doc.rows, DEFAULT_SETTINGS),
        doc.rows,
        doc.meta,
        DEFAULT_SETTINGS,
      );
      const broken = doc.rows.map((r, i) => (i === 2 ? { ...r, value: '스물' } : r));
      const after = buildChartModel(
        buildGraph(broken, DEFAULT_SETTINGS),
        broken,
        doc.meta,
        DEFAULT_SETTINGS,
      );
      for (const id of ['예비비', '강사비', '인쇄물']) {
        expect(node(after, id).color, id).toBe(node(before, id).color);
      }
    });
  });
});
