import {
  sankey,
  sankeyCenter,
  sankeyJustify,
  sankeyLeft,
  sankeyRight,
  type SankeyLink,
  type SankeyNode,
} from 'd3-sankey';
import type { BuildResult, GraphLink, GraphNode, Settings } from './types';

type LayoutSettings = Pick<
  Settings,
  'direction' | 'nodeAlign' | 'nodeWidth' | 'nodePadding' | 'minLinkWidth'
>;

export interface LaidNode extends GraphNode {
  /** 노드 크기 = max(유입, 유출) */
  value: number;
  /** 왼쪽에서 몇 번째 열인지(0부터, 방향 반영 전) */
  depth: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface LaidLink extends GraphLink {
  /** 그릴 두께(minLinkWidth 반영) */
  width: number;
  /** 흐름이 시작·끝나는 x 좌표(그라데이션 방향용) */
  sx: number;
  tx: number;
  /** SVG path d. 굵은 선(stroke)으로 그린다. */
  path: string;
}

export interface LayoutResult {
  width: number;
  height: number;
  nodes: LaidNode[];
  links: LaidLink[];
}

export interface LayoutSize {
  width: number;
  height: number;
  /** 위아래·기본 여백 */
  margin?: number;
  /** 왼쪽·오른쪽 여백(바깥쪽 레이블 자리). 없으면 margin */
  marginLeft?: number;
  marginRight?: number;
}

const ALIGN = {
  justify: sankeyJustify,
  left: sankeyLeft,
  right: sankeyRight,
  center: sankeyCenter,
};

type N = SankeyNode<GraphNode, GraphLink>;
type L = SankeyLink<GraphNode, GraphLink>;

/**
 * d3-sankey로 좌표를 계산한다. 그리기(SVG 요소 생성)는 UI가 맡는다.
 * 입력 graph는 변경하지 않는다. drawable=false인 그래프는 호출하지 않는다.
 */
export function computeLayout(
  graph: Pick<BuildResult, 'nodes' | 'links'>,
  settings: LayoutSettings,
  size: LayoutSize,
): LayoutResult {
  const { width, height } = size;
  const margin = size.margin ?? 4;

  const generator = sankey<GraphNode, GraphLink>()
    .nodeId((d) => d.id)
    .nodeAlign(ALIGN[settings.nodeAlign])
    .nodeWidth(settings.nodeWidth)
    .nodePadding(settings.nodePadding)
    .extent([
      [size.marginLeft ?? margin, margin],
      [width - (size.marginRight ?? margin), height - margin],
    ]);

  const result = generator({
    nodes: graph.nodes.map((n) => ({ ...n })),
    links: graph.links.map((l) => ({ ...l, rowIds: [...l.rowIds] })),
  });

  const rtl = settings.direction === 'rtl';
  const mirror = (x: number) => width - x;

  const nodes: LaidNode[] = (result.nodes as N[]).map((n) => {
    const x0 = n.x0!;
    const x1 = n.x1!;
    return {
      id: n.id,
      label: n.label,
      ...(n.group !== undefined ? { group: n.group } : {}),
      inflow: n.inflow,
      outflow: n.outflow,
      value: n.value!,
      depth: n.depth!,
      x0: rtl ? mirror(x1) : x0,
      x1: rtl ? mirror(x0) : x1,
      y0: n.y0!,
      y1: n.y1!,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const links: LaidLink[] = (result.links as L[]).map((l) => {
    const s = byId.get((l.source as N).id)!;
    const t = byId.get((l.target as N).id)!;
    // 흐름 방향: ltr은 출발 노드의 오른쪽 → 도착 노드의 왼쪽, rtl은 반대.
    const sx = rtl ? s.x0 : s.x1;
    const tx = rtl ? t.x1 : t.x0;
    return {
      id: l.id,
      source: s.id,
      target: t.id,
      value: l.value,
      rowIds: l.rowIds,
      width: Math.max(l.width!, settings.minLinkWidth),
      sx,
      tx,
      path: linkPath(sx, l.y0!, tx, l.y1!),
    };
  });

  return { width, height, nodes, links };
}

/** 가로 방향 3차 베지어. 소수 둘째 자리로 줄여 SVG 크기를 줄인다. */
export function linkPath(sx: number, sy: number, tx: number, ty: number): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  const mx = (sx + tx) / 2;
  return `M${r(sx)},${r(sy)}C${r(mx)},${r(sy)} ${r(mx)},${r(ty)} ${r(tx)},${r(ty)}`;
}

/**
 * 노드 수에 맞춘 기본 차트 높이. 가장 많은 노드가 쌓이는 열을 미리 알 수 없으므로
 * 전체 노드 수로 어림하고 범위를 제한한다.
 */
export function suggestHeight(
  nodeCount: number,
  settings: Pick<Settings, 'nodePadding' | 'fontSize'>,
): number {
  const perNode = Math.max(settings.nodePadding, settings.fontSize) + 14;
  return Math.round(Math.min(1600, Math.max(360, nodeCount * perNode * 0.6)));
}
