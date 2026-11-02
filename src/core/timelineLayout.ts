import type { LaidLink, LaidNode, LayoutResult, LayoutSize } from './layout';
import { linkPath } from './layout';
import type { TimelinePlacement } from './timeline';
import type { BuildResult, Period, Settings } from './types';

type LayoutSettings = Pick<Settings, 'direction' | 'nodeWidth' | 'nodePadding' | 'minLinkWidth'>;

/** 시기 띠의 가로 범위(방향 반영 후) */
export interface PeriodBand {
  period: Period;
  index: number;
  x0: number;
  x1: number;
}

export interface TimelineLayoutResult extends LayoutResult {
  bands: PeriodBand[];
}

interface WorkNode extends LaidNode {
  layer: number;
  ins: WorkLink[];
  outs: WorkLink[];
}

interface WorkLink {
  src: WorkNode;
  tgt: WorkNode;
  value: number;
  width: number;
  base: BuildResult['links'][number];
}

const ITERATIONS = 6;

/**
 * 열(시기·하위 열)이 정해진 생키 배치. d3-sankey와 같은 순서로 동작한다:
 * 열 고정 → 세로 비율(ky) 결정 → 처음 쌓기 → 좌우로 번갈아 위치 완화 + 겹침 해소 → 흐름 위치 계산.
 * d3-sankey는 열을 직접 지정할 수 없어 시기 모드에서만 이 배치를 쓴다.
 */
export function computeTimelineLayout(
  graph: Pick<BuildResult, 'nodes' | 'links'>,
  placement: TimelinePlacement,
  settings: LayoutSettings,
  size: LayoutSize & { top?: number },
): TimelineLayoutResult {
  const { width, height } = size;
  const margin = size.margin ?? 4;
  const left = size.marginLeft ?? margin;
  const right = width - (size.marginRight ?? margin);
  const y0 = margin + (size.top ?? 0);
  const y1 = height - margin;
  const nodeWidth = settings.nodeWidth;

  // ── 가로: 시기마다 같은 폭의 띠. 노드는 띠(하위 열이 있으면 띠를 나눈 칸)의 가운데에 놓는다.
  const P = placement.periods.length;
  const band = (right - left) / P;
  const xOf = (p: number, s: number) => {
    const cell = band / placement.subCount[p]!;
    return left + p * band + (s + 0.5) * cell - nodeWidth / 2;
  };
  const layerBase: number[] = [];
  placement.subCount.reduce((acc, n, i) => ((layerBase[i] = acc), acc + n), 0);

  const nodes: WorkNode[] = graph.nodes.map((n) => {
    const p = placement.period.get(n.id) ?? 0;
    const s = placement.sub.get(n.id) ?? 0;
    const x = xOf(p, s);
    return {
      ...n,
      value: Math.max(n.inflow, n.outflow),
      depth: layerBase[p]! + s,
      layer: layerBase[p]! + s,
      x0: x,
      x1: x + nodeWidth,
      y0: 0,
      y1: 0,
      ins: [],
      outs: [],
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: WorkLink[] = graph.links.map((l) => {
    const link: WorkLink = {
      src: byId.get(l.source)!,
      tgt: byId.get(l.target)!,
      value: l.value,
      width: 0,
      base: l,
    };
    link.src.outs.push(link);
    link.tgt.ins.push(link);
    return link;
  });

  // ── 세로 비율과 처음 쌓기
  const columns = new Map<number, WorkNode[]>();
  for (const n of nodes) {
    if (!columns.has(n.layer)) columns.set(n.layer, []);
    columns.get(n.layer)!.push(n);
  }
  const cols = [...columns.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  const maxLen = Math.max(1, ...cols.map((c) => c.length));
  const py = Math.min(settings.nodePadding, maxLen > 1 ? (y1 - y0) / (maxLen - 1) : Infinity);
  const ky = Math.min(
    ...cols.map((c) => {
      const sum = c.reduce((a, n) => a + n.value, 0);
      return sum > 0 ? (y1 - y0 - (c.length - 1) * py) / sum : Infinity;
    }),
  );
  const k = Number.isFinite(ky) && ky > 0 ? ky : 0;
  for (const l of links) l.width = l.value * k;
  for (const c of cols) {
    let y = y0;
    for (const n of c) {
      n.y0 = y;
      n.y1 = y + n.value * k;
      y = n.y1 + py;
    }
    const extra = (y1 - y + py) / (c.length + 1);
    c.forEach((n, i) => {
      n.y0 += extra * (i + 1);
      n.y1 += extra * (i + 1);
    });
  }

  // ── 위치 완화
  const offsets = () => {
    const outOff = new Map<WorkLink, number>();
    const inOff = new Map<WorkLink, number>();
    for (const n of nodes) {
      let y = 0;
      for (const l of [...n.outs].sort(
        (a, b) => a.tgt.y0 - b.tgt.y0 || a.tgt.layer - b.tgt.layer,
      )) {
        outOff.set(l, y);
        y += l.width;
      }
      y = 0;
      for (const l of [...n.ins].sort((a, b) => a.src.y0 - b.src.y0 || a.src.layer - b.src.layer)) {
        inOff.set(l, y);
        y += l.width;
      }
    }
    return { outOff, inOff };
  };
  const shift = (n: WorkNode, dy: number) => {
    n.y0 += dy;
    n.y1 += dy;
  };
  const resolve = (c: WorkNode[]) => {
    c.sort((a, b) => a.y0 - b.y0);
    let y = y0;
    for (const n of c) {
      if (n.y0 < y) shift(n, y - n.y0);
      y = n.y1 + py;
    }
    y = y1;
    for (let i = c.length - 1; i >= 0; i--) {
      const n = c[i]!;
      if (n.y1 > y) shift(n, y - n.y1);
      y = n.y0 - py;
    }
  };
  const relax = (c: WorkNode[], alpha: number, useIncoming: boolean) => {
    const { outOff, inOff } = offsets();
    for (const n of c) {
      let sum = 0;
      let w = 0;
      const ls = useIncoming ? n.ins : n.outs;
      for (const l of ls) {
        const desired = useIncoming
          ? l.src.y0 + outOff.get(l)! - inOff.get(l)!
          : l.tgt.y0 + inOff.get(l)! - outOff.get(l)!;
        sum += desired * l.value;
        w += l.value;
      }
      if (w > 0) shift(n, (sum / w - n.y0) * alpha);
    }
    resolve(c);
  };
  for (let i = 0; i < ITERATIONS; i++) {
    const alpha = 0.99 ** i;
    for (let c = cols.length - 2; c >= 0; c--) relax(cols[c]!, alpha, false);
    for (let c = 1; c < cols.length; c++) relax(cols[c]!, alpha, true);
  }

  // ── 결과(방향 반영)
  const rtl = settings.direction === 'rtl';
  const mx = (x: number) => (rtl ? width - x : x);
  const { outOff, inOff } = offsets();
  const outNodes: LaidNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    ...(n.group !== undefined ? { group: n.group } : {}),
    inflow: n.inflow,
    outflow: n.outflow,
    value: n.value,
    depth: n.depth,
    x0: rtl ? mx(n.x1) : n.x0,
    x1: rtl ? mx(n.x0) : n.x1,
    y0: n.y0,
    y1: n.y1,
  }));
  const outLinks: LaidLink[] = links.map((l) => {
    const sx = rtl ? mx(l.src.x1) : l.src.x1;
    const tx = rtl ? mx(l.tgt.x0) : l.tgt.x0;
    const sy = l.src.y0 + outOff.get(l)! + l.width / 2;
    const ty = l.tgt.y0 + inOff.get(l)! + l.width / 2;
    return {
      ...l.base,
      rowIds: [...l.base.rowIds],
      width: Math.max(l.width, settings.minLinkWidth),
      sx,
      tx,
      path: linkPath(sx, sy, tx, ty),
    };
  });

  // 띠: 같은 폭. 첫 띠와 마지막 띠는 캔버스 끝까지 늘린다.
  const bands: PeriodBand[] = placement.periods.map((period, i) => {
    const a = i === 0 ? 0 : left + i * band;
    const b = i === P - 1 ? width : left + (i + 1) * band;
    return { period, index: i, x0: rtl ? mx(b) : a, x1: rtl ? mx(a) : b };
  });

  return { width, height, nodes: outNodes, links: outLinks, bands };
}
