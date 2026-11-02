import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { DEFAULT_SETTINGS } from './config';
import { computeLayout, linkPath, suggestHeight } from './layout';
import { DEFAULT_PALETTE, assignColors, contrastRatio } from './palette';
import { SAMPLES, loadSample } from './samples';

const size = { width: 800, height: 500 };

function layoutOf(id: string, settings = DEFAULT_SETTINGS) {
  const g = buildGraph(loadSample(id).rows, settings);
  return { g, layout: computeLayout(g, settings, size) };
}

describe('computeLayout', () => {
  it.each(SAMPLES.map((s) => s.id))('%s: 모든 좌표가 유한하고 캔버스 안에 있다', (id) => {
    const { g, layout } = layoutOf(id);
    expect(layout.nodes).toHaveLength(g.nodes.length);
    expect(layout.links).toHaveLength(g.links.length);
    for (const n of layout.nodes) {
      for (const v of [n.x0, n.x1, n.y0, n.y1]) expect(Number.isFinite(v)).toBe(true);
      expect(n.x0).toBeGreaterThanOrEqual(0);
      expect(n.x1).toBeLessThanOrEqual(size.width);
      expect(n.y0).toBeGreaterThanOrEqual(0);
      expect(n.y1).toBeLessThanOrEqual(size.height);
      expect(n.x1 - n.x0).toBeCloseTo(DEFAULT_SETTINGS.nodeWidth);
    }
    for (const l of layout.links) {
      expect(l.path).toMatch(/^M[\d.]+,[\d.]+C/);
      expect(l.path).not.toContain('NaN');
      expect(l.width).toBeGreaterThan(0);
    }
  });

  it('노드 값은 max(유입, 유출), 시작 노드는 왼쪽 열', () => {
    const { layout } = layoutOf('budget');
    const root = layout.nodes.find((n) => n.id === '전체 예산')!;
    expect(root.value).toBe(100);
    expect(root.depth).toBe(0);
    expect(root.x0).toBeCloseTo(4);
  });

  it('rtl이면 x 좌표를 좌우로 뒤집는다', () => {
    const ltr = layoutOf('budget').layout;
    const rtl = layoutOf('budget', { ...DEFAULT_SETTINGS, direction: 'rtl' }).layout;
    const a = ltr.nodes.find((n) => n.id === '전체 예산')!;
    const b = rtl.nodes.find((n) => n.id === '전체 예산')!;
    expect(b.x1).toBeCloseTo(size.width - a.x0);
    expect(b.y0).toBeCloseTo(a.y0);
    // 링크는 시작 노드의 왼쪽 변에서 출발한다.
    const link = rtl.links.find((l) => l.source === '전체 예산')!;
    expect(link.path.startsWith(`M${Math.round(b.x0 * 100) / 100},`)).toBe(true);
  });

  it('작은 흐름은 최소 두께를 보장한다', () => {
    const settings = { ...DEFAULT_SETTINGS, minLinkWidth: 3 };
    const rows = [
      { id: 'a', source: 'A', target: 'B', value: '100000' },
      { id: 'b', source: 'A', target: 'C', value: '1' },
    ];
    const layout = computeLayout(buildGraph(rows, settings), settings, size);
    expect(layout.links.find((l) => l.id === 'b')!.width).toBe(3);
  });

  it('separate 모드의 같은 쌍 링크도 각각 배치한다', () => {
    const settings = { ...DEFAULT_SETTINGS, duplicateMode: 'separate' as const };
    const rows = [
      { id: 'a', source: 'A', target: 'B', value: '3' },
      { id: 'b', source: 'A', target: 'B', value: '2' },
    ];
    const layout = computeLayout(buildGraph(rows, settings), settings, size);
    expect(layout.links.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('입력 그래프를 변경하지 않는다', () => {
    const g = buildGraph(loadSample('energy').rows, DEFAULT_SETTINGS);
    const before = structuredClone(g);
    computeLayout(g, DEFAULT_SETTINGS, size);
    expect(g).toEqual(before);
  });
});

describe('helpers', () => {
  it('linkPath', () => {
    expect(linkPath(0, 10, 100, 50.123)).toBe('M0,10C50,10 50,50.12 100,50.12');
  });

  it('suggestHeight는 범위를 지킨다', () => {
    expect(suggestHeight(1, DEFAULT_SETTINGS)).toBe(360);
    expect(suggestHeight(10000, DEFAULT_SETTINGS)).toBe(1600);
  });

  it('assignColors: 순서대로, 같은 키는 같은 색', () => {
    const c = assignColors(['a', 'b', 'a', 'c']);
    expect([...c.values()]).toEqual(DEFAULT_PALETTE.slice(0, 3));
  });

  it.each(DEFAULT_PALETTE)('팔레트 %s는 흰 배경 대비 3:1 이상', (color) => {
    expect(contrastRatio(color, '#ffffff')).toBeGreaterThanOrEqual(3);
  });
});
