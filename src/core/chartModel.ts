import { formatWithUnit } from './format';
import { computeLayout, suggestHeight, type LaidLink, type LaidNode } from './layout';
import { NEUTRAL_LINK_COLOR, nodeColors } from './palette';
import { estimateTextWidth, wrapText } from './text';
import { resolveTimeline } from './timeline';
import { computeTimelineLayout, type PeriodBand } from './timelineLayout';
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
  /** 시기 모드: 놓인 시기 번호와 자동 추정 여부 */
  periodIndex?: number;
  periodInferred?: boolean;
  /** 노드 메모(있을 때) */
  note?: string;
  /** 각주 모드: 레이블 뒤에 붙는 번호("[1]") */
  noteMark?: string;
  /** 레이블 아래 모드: 줄바꿈한 메모(최대 2줄) */
  noteLines?: string[];
}

/** 각주 모드에서 차트 아래에 보일 메모 목록 */
export interface ChartFootnote {
  mark: string;
  nodeId: string;
  label: string;
  text: string;
}

/** 시기 모드의 시기 띠·머리글 */
export interface ChartPeriod {
  id: string;
  label: string;
  index: number;
  x0: number;
  x1: number;
  /** 머리글 가운데 x */
  cx: number;
  /** 번갈아 칠하는 띠 */
  shaded: boolean;
  labelY: number;
  totalsY: number;
  /** "들어옴 12 · 나감 8"(다른 시기와 오간 흐름). 표시하지 않으면 빈 문자열 */
  totalsText: string;
  nodeIds: string[];
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
  /** 시기 모드가 아니면 빈 배열 */
  periods: ChartPeriod[];
  showBands: boolean;
  /** 시기 머리글 높이(시기 모드가 아니면 0) */
  headerHeight: number;
  noteDisplay: Settings['noteDisplay'];
  /** 각주 모드가 아니면 빈 배열 */
  footnotes: ChartFootnote[];
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
  notes: Readonly<Record<string, string>> = {},
): ChartModel {
  const fmt = (v: number) => formatWithUnit(v, meta.unit, settings.numberFormat);
  const noteOf = (id: string) => notes[id]?.trim() || undefined;
  const footnoteMode = settings.noteDisplay === 'footnote';
  const labelText = (n: LaidNode) =>
    (settings.showValues ? `${n.label} ${fmt(n.value)}` : n.label) +
    (footnoteMode && noteOf(n.id) ? ' [00]' : '');

  // 시기 모드: 노드를 지정한 시기 열에 놓고, 위에 시기 머리글 자리를 둔다.
  const placement = resolveTimeline(graph.nodes, graph.links, settings.timeline);
  const fs = settings.fontSize;
  const headerHeight = placement
    ? Math.round(fs * (settings.timeline.showTotals ? 2.9 : 1.8) + 8)
    : 0;
  const height = suggestHeight(graph.nodes.length, settings) + headerHeight;
  let bands: PeriodBand[] = [];
  const run = (sz: { marginLeft?: number; marginRight?: number }) => {
    if (!placement) return computeLayout(graph, settings, { width, height, ...sz });
    const r = computeTimelineLayout(graph, placement, settings, {
      width,
      height,
      top: headerHeight,
      ...sz,
    });
    bands = r.bands;
    return r;
  };

  let layout = run({});

  if (settings.labelPosition === 'outside') {
    // 첫 배치로 양끝 열을 찾고, 그 레이블 폭만큼 여백을 잡아 다시 배치한다.
    const { left, right } = edgeNodes(layout.nodes);
    const maxWidth = (ns: LaidNode[]) =>
      Math.max(0, ...ns.map((n) => estimateTextWidth(labelText(n), settings.fontSize)));
    const cap = width * 0.35;
    const marginLeft = Math.min(cap, maxWidth(left) + LABEL_GAP + 4);
    const marginRight = Math.min(cap, maxWidth(right) + LABEL_GAP + 4);
    layout = run({ marginLeft, marginRight });
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
    // 시기 모드: 레이블을 자기 시기 띠 안(노드 오른쪽)에 두어 이웃 시기 레이블과 겹치지 않게 한다.
    else if (placement) side = rightIds.has(n.id) ? 'left' : 'right';
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
      ...(placement && {
        periodIndex: placement.period.get(n.id)!,
        periodInferred: placement.inferred.has(n.id),
      }),
      ...(noteOf(n.id) && { note: noteOf(n.id)! }),
    };
  });

  // 노드 메모: 레이블 아래(최대 2줄) 또는 읽는 순서(왼쪽 열 → 위)대로 번호를 단 각주
  const footnotes: ChartFootnote[] = [];
  if (settings.noteDisplay === 'below') {
    const maxW = Math.min(220, width * 0.24);
    const noteFs = fs * 0.85;
    for (const n of nodes) {
      if (!n.note) continue;
      const lines = wrapText(n.note, maxW, noteFs);
      n.noteLines = lines.length > 2 ? [lines[0]!, `${lines[1]!.replace(/.$/u, '')}…`] : lines;
    }
  } else if (footnoteMode) {
    const ordered = nodes.filter((n) => n.note).sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
    ordered.forEach((n, i) => {
      n.noteMark = `[${i + 1}]`;
      footnotes.push({ mark: n.noteMark, nodeId: n.id, label: n.label, text: n.note! });
    });
  }

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

  // 시기 머리글: 다른 시기와 오간 흐름 합계, 시기에 속한 노드·행
  const periods: ChartPeriod[] = [];
  if (placement) {
    const into = placement.periods.map(() => 0);
    const outOf = placement.periods.map(() => 0);
    for (const l of links) {
      const ps = placement.period.get(l.source)!;
      const pt = placement.period.get(l.target)!;
      if (ps === pt) continue;
      outOf[ps]! += l.value;
      into[pt]! += l.value;
    }
    const labelY = 4 + fs * 1.1;
    for (const b of bands) {
      const members = nodes.filter((n) => n.periodIndex === b.index);
      const totals = [
        into[b.index]! > 0 ? `들어옴 ${fmt(into[b.index]!)}` : '',
        outOf[b.index]! > 0 ? `나감 ${fmt(outOf[b.index]!)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      periods.push({
        id: b.period.id,
        label: b.period.label,
        index: b.index,
        x0: b.x0,
        x1: b.x1,
        cx: (b.x0 + b.x1) / 2,
        shaded: b.index % 2 === 1,
        labelY,
        totalsY: labelY + fs * 1.25,
        totalsText: settings.timeline.showTotals ? totals : '',
        nodeIds: members.map((n) => n.id),
        rowIds: [...new Set(members.flatMap((n) => n.rowIds))].sort(
          (a, b2) => (rowOrder.get(a) ?? 0) - (rowOrder.get(b2) ?? 0),
        ),
      });
    }
  }

  return {
    width,
    height,
    nodes,
    links,
    periods,
    showBands: !!placement && settings.timeline.showBands,
    headerHeight,
    noteDisplay: settings.noteDisplay,
    footnotes,
  };
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
