import { formatWithUnit } from './format';
import { computeLayout, suggestHeight, type LaidLink, type LaidNode } from './layout';
import { NEUTRAL_LINK_COLOR, nodeColors } from './palette';
import { estimateTextWidth } from './text';
import type { BuildResult, DiagramMeta, Row, Settings } from './types';

export const LABEL_GAP = 6;
export const DEFAULT_CHART_WIDTH = 960;

export interface ChartNode extends LaidNode {
  color: string;
  /** "40 백만 원" */
  valueText: string;
  labelX: number;
  labelY: number;
  labelAnchor: 'start' | 'end';
  /** 이 노드에 닿는 흐름을 만든 원본 행(입력 순서) */
  rowIds: string[];
}

export interface ChartLink extends LaidLink {
  /** 단색 흐름의 색 */
  color: string;
  sourceColor: string;
  targetColor: string;
  sourceLabel: string;
  targetLabel: string;
  valueText: string;
  /** 출발 노드에서 나가는 값 중 이 흐름의 비율(0~1) */
  shareOfSource: number;
}

export interface ChartModel {
  width: number;
  height: number;
  nodes: ChartNode[];
  links: ChartLink[];
}

type ModelSettings = Settings;

/**
 * 그래프 → 그릴 준비가 된 모델(좌표, 색, 레이블 위치, 표시 문자열).
 * 화면 미리보기와 SVG·PNG 내보내기가 같은 모델을 쓴다. drawable 그래프만 넘긴다.
 */
export function buildChartModel(
  graph: BuildResult,
  rows: readonly Row[],
  meta: Pick<DiagramMeta, 'unit'>,
  settings: ModelSettings,
  width = DEFAULT_CHART_WIDTH,
): ChartModel {
  const height = suggestHeight(graph.nodes.length, settings);
  const fmt = (v: number) => formatWithUnit(v, meta.unit, settings.numberFormat);
  const labelText = (n: LaidNode) => (settings.showValues ? `${n.label} ${fmt(n.value)}` : n.label);

  let layout = computeLayout(graph, settings, { width, height });

  if (settings.labelPosition === 'outside') {
    // 첫 배치로 양끝 열을 찾고, 그 레이블 폭만큼 여백을 잡아 다시 배치한다.
    const { left, right } = edgeNodes(layout.nodes);
    const maxWidth = (ns: LaidNode[]) =>
      Math.max(0, ...ns.map((n) => estimateTextWidth(labelText(n), settings.fontSize)));
    const cap = width * 0.35;
    const marginLeft = Math.min(cap, maxWidth(left) + LABEL_GAP + 4);
    const marginRight = Math.min(cap, maxWidth(right) + LABEL_GAP + 4);
    layout = computeLayout(graph, settings, { width, height, marginLeft, marginRight });
  }

  const colors = nodeColors(rows, layout.nodes, settings);
  const { left, right } = edgeNodes(layout.nodes);
  const leftIds = new Set(left.map((n) => n.id));
  const rightIds = new Set(right.map((n) => n.id));

  const rowOrder = new Map(rows.map((r, i) => [r.id, i]));
  const rowIdsByNode = new Map<string, Set<string>>();
  for (const l of layout.links) {
    for (const id of [l.source, l.target]) {
      if (!rowIdsByNode.has(id)) rowIdsByNode.set(id, new Set());
      for (const r of l.rowIds) rowIdsByNode.get(id)!.add(r);
    }
  }

  const nodes: ChartNode[] = layout.nodes.map((n) => {
    let side: 'left' | 'right';
    if (settings.labelPosition === 'outside' && leftIds.has(n.id)) side = 'left';
    else if (settings.labelPosition === 'outside' && rightIds.has(n.id)) side = 'right';
    else side = (n.x0 + n.x1) / 2 < width / 2 ? 'right' : 'left';
    return {
      ...n,
      color: colors.get(n.id)!,
      valueText: fmt(n.value),
      labelX: side === 'right' ? n.x1 + LABEL_GAP : n.x0 - LABEL_GAP,
      labelY: (n.y0 + n.y1) / 2,
      labelAnchor: side === 'right' ? 'start' : 'end',
      rowIds: [...(rowIdsByNode.get(n.id) ?? [])].sort(
        (a, b) => (rowOrder.get(a) ?? 0) - (rowOrder.get(b) ?? 0),
      ),
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: ChartLink[] = layout.links.map((l) => {
    const s = byId.get(l.source)!;
    const t = byId.get(l.target)!;
    const color =
      settings.linkColor === 'target'
        ? t.color
        : settings.linkColor === 'neutral'
          ? NEUTRAL_LINK_COLOR
          : s.color; // source, gradient(단색 대체값)
    return {
      ...l,
      color,
      sourceColor: s.color,
      targetColor: t.color,
      sourceLabel: s.label,
      targetLabel: t.label,
      valueText: fmt(l.value),
      shareOfSource: s.outflow > 0 ? l.value / s.outflow : 0,
    };
  });

  return { width, height, nodes, links };
}

/** 가장 왼쪽 열과 가장 오른쪽 열의 노드 */
function edgeNodes(nodes: readonly LaidNode[]) {
  if (nodes.length === 0) return { left: [], right: [] };
  const minX = Math.min(...nodes.map((n) => n.x0));
  const maxX = Math.max(...nodes.map((n) => n.x1));
  return {
    left: nodes.filter((n) => n.x0 - minX < 0.5),
    right: nodes.filter((n) => maxX - n.x1 < 0.5),
  };
}
