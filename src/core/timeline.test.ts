import { describe, expect, it } from 'vitest';
import { buildGraph } from './buildGraph';
import { buildChartModel } from './chartModel';
import { DEFAULT_SETTINGS } from './config';
import { periodsFromLabels, resolveTimeline } from './timeline';
import { computeTimelineLayout } from './timelineLayout';
import type { Row, Settings, TimelineSettings } from './types';

let seq = 0;
const row = (source: string, target: string, value: number): Row => ({
  id: `r${++seq}`,
  source,
  target,
  value: String(value),
});

const P = (...labels: string[]) => labels.map((label, i) => ({ id: `p${i}`, label }));

function timeline(
  nodePeriods: Record<string, string>,
  periods = P('2018', '2019', '2020', '2021'),
) {
  return {
    enabled: true,
    periods,
    nodePeriods,
    showBands: true,
    showTotals: false,
  } satisfies TimelineSettings;
}

const settingsWith = (t: TimelineSettings): Settings => ({ ...DEFAULT_SETTINGS, timeline: t });

// 스크린샷 사례를 줄인 것: 단계 깊이는 같지만 시기가 다른 노드들
const rows = [
  row('IT개발자들', 'ITVN', 3),
  row('희망제작소', 'IT단체설립모임', 3),
  row('ITVN', '공동체IT', 3),
  row('IT단체설립모임', '공동체IT', 3),
];

describe('resolveTimeline', () => {
  it('꺼져 있거나 시기가 없으면 null', () => {
    const g = buildGraph(rows, DEFAULT_SETTINGS);
    expect(resolveTimeline(g.nodes, g.links, DEFAULT_SETTINGS.timeline)).toBeNull();
    expect(resolveTimeline(g.nodes, g.links, { ...timeline({}), periods: [] })).toBeNull();
  });

  it('지정한 시기에 놓고, 지정하지 않은 노드는 연결을 따라 추정한다', () => {
    const t = timeline({ IT개발자들: 'p0', 희망제작소: 'p2', 공동체IT: 'p3' });
    const g = buildGraph(rows, settingsWith(t));
    const pl = resolveTimeline(g.nodes, g.links, t)!;
    expect(Object.fromEntries(pl.period)).toEqual({
      IT개발자들: 0,
      ITVN: 0, // 출발(2018)을 따라감 → 같은 시기 안 다음 하위 열
      희망제작소: 2,
      IT단체설립모임: 2,
      공동체IT: 3,
    });
    expect([...pl.inferred].sort()).toEqual(['ITVN', 'IT단체설립모임']);
    expect(pl.sub.get('IT개발자들')).toBe(0);
    expect(pl.sub.get('ITVN')).toBe(1);
    expect(pl.subCount).toEqual([2, 1, 2, 1]);
    expect(pl.backward).toEqual([]);
  });

  it('들어오는 흐름이 없으면 도착 노드 중 가장 이른 시기를 따른다', () => {
    const t = timeline({ ITVN: 'p1' });
    const g = buildGraph([row('IT개발자들', 'ITVN', 1)], settingsWith(t));
    const pl = resolveTimeline(g.nodes, g.links, t)!;
    expect(pl.period.get('IT개발자들')).toBe(1);
    expect(pl.sub.get('IT개발자들')).toBe(0);
    expect(pl.sub.get('ITVN')).toBe(1);
  });

  it('아무 연결로도 정할 수 없으면 첫 시기', () => {
    const t = timeline({});
    const g = buildGraph([row('A', 'B', 1)], settingsWith(t));
    const pl = resolveTimeline(g.nodes, g.links, t)!;
    expect(pl.period.get('A')).toBe(0);
    expect(pl.inferred.size).toBe(2);
  });

  it('없는 시기 id로 지정한 노드는 지정하지 않은 것으로 본다', () => {
    const t = timeline({ A: 'deleted', B: 'p2' });
    const g = buildGraph([row('A', 'B', 1)], settingsWith(t));
    const pl = resolveTimeline(g.nodes, g.links, t)!;
    expect(pl.period.get('A')).toBe(2);
    expect(pl.inferred.has('A')).toBe(true);
  });

  it('시간을 거슬러 가는 흐름을 찾는다', () => {
    const t = timeline({ A: 'p2', B: 'p0' });
    const g = buildGraph([row('A', 'B', 1)], settingsWith(t));
    expect(resolveTimeline(g.nodes, g.links, t)!.backward.map((l) => l.source)).toEqual(['A']);
  });
});

describe('buildGraph 시기 안내', () => {
  it('거슬러 가는 흐름은 경고, 자동으로 놓은 노드는 안내', () => {
    const t = timeline({ A: 'p2', B: 'p0' });
    const g = buildGraph([row('A', 'B', 1), row('B', 'C', 1)], settingsWith(t));
    const backward = g.issues.find((i) => i.code === 'TIME_BACKWARD')!;
    expect(backward.level).toBe('warning');
    expect(backward.message).toContain('"A → B" 흐름이 시간을 거슬러 갑니다(2020 → 2018)');
    const inferred = g.issues.find((i) => i.code === 'TIME_INFERRED')!;
    expect(inferred).toMatchObject({ level: 'info' });
    expect(inferred.message).toContain('1개');
  });

  it('모두 지정하면 안내가 없다', () => {
    const t = timeline({ A: 'p0', B: 'p1' });
    const g = buildGraph([row('A', 'B', 1)], settingsWith(t));
    expect(g.issues).toEqual([]);
  });
});

describe('computeTimelineLayout', () => {
  const size = { width: 1000, height: 500, margin: 4 };

  function layout(t: TimelineSettings, input = rows) {
    const s = settingsWith(t);
    const g = buildGraph(input, s);
    const pl = resolveTimeline(g.nodes, g.links, t)!;
    return computeTimelineLayout(g, pl, s, { ...size, top: 30 });
  }
  const node = (l: ReturnType<typeof layout>, id: string) => l.nodes.find((n) => n.id === id)!;

  it('같은 단계 깊이라도 시기가 다르면 다른 열에 놓는다', () => {
    const l = layout(timeline({ IT개발자들: 'p0', 희망제작소: 'p2', 공동체IT: 'p3' }));
    // d3 기본 배치라면 IT개발자들과 희망제작소는 같은 첫 열이다.
    expect(node(l, '희망제작소').x0).toBeGreaterThan(node(l, 'IT개발자들').x0 + 400);
    // 노드가 없는 2019도 자리를 차지하고, 띠는 모두 같은 폭이다(양끝은 여백까지).
    const inner = l.bands.slice(1, -1).map((b) => b.x1 - b.x0);
    expect(inner[0]).toBeCloseTo(inner[1]!, 6);
    expect(l.bands[0]!.x0).toBe(0);
    expect(l.bands.at(-1)!.x1).toBe(size.width);
    // 하위 열이 하나인 시기의 노드는 띠 가운데에 놓인다.
    const last = node(l, '공동체IT');
    const lastBand = l.bands[3]!;
    expect((last.x0 + last.x1) / 2).toBeCloseTo((lastBand.x0 + size.width - 4) / 2, 6);
  });

  it('같은 시기 안 하위 열은 띠 안에서 오른쪽으로 놓인다', () => {
    const l = layout(timeline({ IT개발자들: 'p0', 희망제작소: 'p2', 공동체IT: 'p3' }));
    const a = node(l, 'IT개발자들');
    const b = node(l, 'ITVN');
    const band0 = l.bands[0]!;
    expect(b.x0).toBeGreaterThan(a.x1);
    expect(b.x1).toBeLessThanOrEqual(band0.x1);
  });

  it('노드가 머리글 아래·캔버스 안에 있고 같은 열에서 겹치지 않는다', () => {
    const many = [
      ...rows,
      row('시민단체', '공동체IT', 5),
      row('진보네트워크', '공동체IT', 1),
      row('노동네트워크', '공동체IT', 1),
    ];
    const l = layout(timeline({ 공동체IT: 'p3' }), many);
    for (const n of l.nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(4 + 30 - 1e-6);
      expect(n.y1).toBeLessThanOrEqual(500 - 4 + 1e-6);
      for (const v of [n.x0, n.x1, n.y0, n.y1]) expect(Number.isFinite(v)).toBe(true);
    }
    const byX = new Map<number, typeof l.nodes>();
    for (const n of l.nodes) {
      const k = Math.round(n.x0);
      byX.set(k, [...(byX.get(k) ?? []), n]);
    }
    for (const col of byX.values()) {
      const sorted = [...col].sort((a, b) => a.y0 - b.y0);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.y0).toBeGreaterThanOrEqual(sorted[i - 1]!.y1 - 1e-6);
      }
    }
    for (const lk of l.links) expect(lk.path).not.toContain('NaN');
  });

  it('흐름 두께는 값에 비례한다', () => {
    const l = layout(timeline({ IT개발자들: 'p0', 공동체IT: 'p3' }), [
      row('IT개발자들', '공동체IT', 4),
      row('IT개발자들', 'X', 2),
    ]);
    const [a, b] = l.links;
    expect(a!.width / b!.width).toBeCloseTo(2);
  });

  it('rtl이면 시기 순서도 오른쪽에서 왼쪽', () => {
    const t = timeline({ IT개발자들: 'p0', 공동체IT: 'p3' });
    const s = { ...settingsWith(t), direction: 'rtl' as const };
    const g = buildGraph(rows, s);
    const l = computeTimelineLayout(g, resolveTimeline(g.nodes, g.links, t)!, s, size);
    expect(node(l, 'IT개발자들').x0).toBeGreaterThan(node(l, '공동체IT').x1);
    expect(l.bands[0]!.x1).toBeCloseTo(1000);
    expect(l.bands[3]!.x0).toBeCloseTo(0);
  });
});

describe('chartModel 시기 머리글', () => {
  it('시기 머리글·띠·합계, 노드의 시기 정보', () => {
    const t = {
      ...timeline({ IT개발자들: 'p0', 희망제작소: 'p2', 공동체IT: 'p3' }),
      showTotals: true,
    };
    const s = settingsWith(t);
    const g = buildGraph(rows, s);
    const m = buildChartModel(g, rows, { unit: '명' }, s, 1000);
    expect(m.periods.map((p) => p.label)).toEqual(['2018', '2019', '2020', '2021']);
    expect(m.periods.map((p) => p.shaded)).toEqual([false, true, false, true]);
    expect(m.showBands).toBe(true);
    const p2021 = m.periods[3]!;
    expect(p2021.totalsText).toBe('들어옴 6 명');
    expect(m.periods[0]!.totalsText).toBe('나감 3 명');
    expect(m.periods[1]!.nodeIds).toEqual([]);
    expect(p2021.rowIds).toEqual([rows[2]!.id, rows[3]!.id]);
    const itvn = m.nodes.find((n) => n.id === 'ITVN')!;
    expect(itvn).toMatchObject({ periodIndex: 0, periodInferred: true });
    // 머리글 자리만큼 노드가 아래에서 시작한다
    expect(Math.min(...m.nodes.map((n) => n.y0))).toBeGreaterThan(p2021.totalsY);
  });

  it('시기 모드가 아니면 periods가 비어 있다', () => {
    const g = buildGraph(rows, DEFAULT_SETTINGS);
    const m = buildChartModel(g, rows, { unit: '' }, DEFAULT_SETTINGS);
    expect(m.periods).toEqual([]);
    expect(m.showBands).toBe(false);
  });
});

describe('periodsFromLabels', () => {
  it('새 이름만 숫자 순서로 뒤에 더한다', () => {
    const out = periodsFromLabels(['2020', '2018', '2019년', '2018', ' '], P('2018'));
    expect(out.map((p) => p.label)).toEqual(['2018', '2019년', '2020']);
    expect(new Set(out.map((p) => p.id)).size).toBe(3);
  });

  it('숫자가 섞인 이름은 자연스러운 순서', () => {
    const out = periodsFromLabels(['10단계', '2단계', '1단계'], []);
    expect(out.map((p) => p.label)).toEqual(['1단계', '2단계', '10단계']);
  });

  it('시기 모드 레이블: 맨 오른쪽 열만 왼쪽, 나머지는 노드 오른쪽(띠 안)', () => {
    const t = timeline({ IT개발자들: 'p0', 희망제작소: 'p2', 공동체IT: 'p3' });
    const s = settingsWith(t);
    const m = buildChartModel(buildGraph(rows, s), rows, { unit: '' }, s, 1000);
    const anchor = (id: string) => m.nodes.find((n) => n.id === id)!.labelAnchor;
    expect(anchor('희망제작소')).toBe('start'); // 오른쪽 절반이지만 띠 안쪽으로
    expect(anchor('IT단체설립모임')).toBe('start');
    expect(anchor('공동체IT')).toBe('end');
  });
});
