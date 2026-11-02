import { formatValue } from './format';
import { resolveTimeline } from './timeline';
import { validate } from './validate';
import type { BuildResult, GraphLink, GraphNode, Issue, Row, Settings } from './types';
import { ko } from '../i18n/ko';

type BuildSettings = Pick<Settings, 'duplicateMode' | 'numberFormat'> &
  Partial<Pick<Settings, 'timeline'>>;

/**
 * 입력 행 → 생키 그래프. 같은 이름(정규화 기준)은 같은 노드가 된다.
 * 순환이 있거나 그릴 링크가 없으면 drawable=false.
 */
export function buildGraph(rows: readonly Row[], settings: BuildSettings): BuildResult {
  const { issues, validRows } = validate(rows);

  // 노드: 처음 나온 원문 이름을 레이블로 쓴다.
  const nodes = new Map<string, GraphNode>();
  const groupAsTarget = new Map<string, string>();
  const groupAsSource = new Map<string, string>();
  const ensure = (id: string, label: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, inflow: 0, outflow: 0 });
    return nodes.get(id)!;
  };

  // 링크: merge면 같은 출발·도착 쌍을 합산, separate면 행마다 따로.
  const links: GraphLink[] = [];
  const byPair = new Map<string, GraphLink>();
  const pairCount = new Map<string, { link: GraphLink; count: number; lastRowId: string }>();

  for (const r of validRows) {
    const s = ensure(r.source, r.sourceLabel);
    const t = ensure(r.target, r.targetLabel);
    s.outflow += r.value;
    t.inflow += r.value;
    if (r.group) {
      if (!groupAsTarget.has(r.target)) groupAsTarget.set(r.target, r.group);
      if (!groupAsSource.has(r.source)) groupAsSource.set(r.source, r.group);
    }

    const key = `${r.source}\u0000${r.target}`;
    const existing = byPair.get(key);
    if (existing && settings.duplicateMode === 'merge') {
      existing.value += r.value;
      existing.rowIds.push(r.rowId);
    } else {
      const link: GraphLink = {
        id: r.rowId,
        source: r.source,
        target: r.target,
        value: r.value,
        rowIds: [r.rowId],
      };
      links.push(link);
      if (!existing) byPair.set(key, link);
    }
    const pc = pairCount.get(key);
    if (pc) {
      pc.count += 1;
      pc.lastRowId = r.rowId;
    } else {
      pairCount.set(key, { link: byPair.get(key)!, count: 1, lastRowId: r.rowId });
    }
  }

  // 노드 색상 그룹: 들어오는 행의 그룹을 우선, 시작 노드는 나가는 행의 그룹.
  for (const node of nodes.values()) {
    const group = groupAsTarget.get(node.id) ?? groupAsSource.get(node.id);
    if (group) node.group = group;
  }

  for (const { link, count, lastRowId } of pairCount.values()) {
    if (count < 2) continue;
    const s = nodes.get(link.source)!.label;
    const t = nodes.get(link.target)!.label;
    issues.push({
      level: 'info',
      code: 'DUPLICATE_PAIR',
      rowId: lastRowId,
      message:
        settings.duplicateMode === 'merge'
          ? ko.issue.duplicateMerged(s, t, count)
          : ko.issue.duplicateSeparate(s, t, count),
    });
  }

  const nodeList = [...nodes.values()];
  const cycle = findCycle(nodeList, links);
  if (cycle) {
    issues.push({
      level: 'error',
      code: 'CYCLE',
      rowId: cycle.rowId,
      nodeName: cycle.path[0],
      message: ko.issue.cycle(cycle.path.map((id) => nodes.get(id)!.label)),
    });
  } else {
    issues.push(...imbalanceIssues(nodeList, settings));
    issues.push(...timelineIssues(nodeList, links, settings));
    const groups = countComponents(nodeList, links);
    if (groups > 1) {
      issues.push({
        level: 'info',
        code: 'DISCONNECTED_GROUPS',
        message: ko.issue.disconnected(groups),
      });
    }
  }

  return {
    nodes: nodeList,
    links,
    issues,
    drawable: links.length > 0 && !cycle,
  };
}

/** 시기 모드: 시간을 거슬러 가는 흐름(경고), 자동으로 놓은 노드(안내) */
function timelineIssues(nodes: GraphNode[], links: GraphLink[], settings: BuildSettings): Issue[] {
  if (!settings.timeline) return [];
  const placement = resolveTimeline(nodes, links, settings.timeline);
  if (!placement) return [];
  const label = new Map(nodes.map((n) => [n.id, n.label]));
  const name = (id: string) => placement.periods[placement.period.get(id)!]!.label;
  const out: Issue[] = placement.backward.map((l) => ({
    level: 'warning',
    code: 'TIME_BACKWARD',
    rowId: l.rowIds[0]!,
    message: ko.issue.timeBackward(
      label.get(l.source)!,
      label.get(l.target)!,
      name(l.source),
      name(l.target),
    ),
  }));
  if (placement.inferred.size > 0) {
    out.push({
      level: 'info',
      code: 'TIME_INFERRED',
      message: ko.issue.timeInferred(placement.inferred.size),
    });
  }
  return out;
}

/** 중간 노드(유입·유출이 모두 있는 노드)의 값이 다르면 경고. */
function imbalanceIssues(nodes: GraphNode[], settings: BuildSettings): Issue[] {
  const out: Issue[] = [];
  for (const n of nodes) {
    if (n.inflow === 0 || n.outflow === 0) continue;
    const tolerance = 1e-9 * Math.max(n.inflow, n.outflow);
    if (Math.abs(n.inflow - n.outflow) <= tolerance) continue;
    out.push({
      level: 'warning',
      code: 'IMBALANCE',
      nodeName: n.id,
      message: ko.issue.imbalance(
        n.label,
        formatValue(n.inflow, settings.numberFormat),
        formatValue(n.outflow, settings.numberFormat),
      ),
    });
  }
  return out;
}

/**
 * 반복 DFS로 순환 하나를 찾는다. 경로는 시작 노드로 끝나며(A → B → A),
 * rowId는 순환을 닫는 링크의 첫 행이다.
 */
export function findCycle(
  nodes: readonly GraphNode[],
  links: readonly GraphLink[],
): { path: string[]; rowId: string } | null {
  const adj = new Map<string, GraphLink[]>();
  for (const l of links) {
    if (!adj.has(l.source)) adj.set(l.source, []);
    adj.get(l.source)!.push(l);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]));

  for (const start of nodes) {
    if (color.get(start.id) !== WHITE) continue;
    // 스택 원소: [노드, 다음에 볼 간선 인덱스]
    const stack: [string, number][] = [[start.id, 0]];
    const pathIndex = new Map<string, number>([[start.id, 0]]);
    const path: string[] = [start.id];
    color.set(start.id, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const [node, i] = frame;
      const edges = adj.get(node) ?? [];
      if (i < edges.length) {
        frame[1] = i + 1;
        const edge = edges[i]!;
        const next = edge.target;
        const c = color.get(next);
        if (c === GRAY) {
          const from = pathIndex.get(next)!;
          return { path: [...path.slice(from), next], rowId: edge.rowIds[0]! };
        }
        if (c === WHITE) {
          color.set(next, GRAY);
          pathIndex.set(next, path.length);
          path.push(next);
          stack.push([next, 0]);
        }
      } else {
        color.set(node, BLACK);
        pathIndex.delete(node);
        path.pop();
        stack.pop();
      }
    }
  }
  return null;
}

/** 방향을 무시했을 때 서로 이어진 묶음 수(union-find). */
function countComponents(nodes: readonly GraphNode[], links: readonly GraphLink[]): number {
  const parent = new Map<string, string>(nodes.map((n) => [n.id, n.id]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  let count = nodes.length;
  for (const l of links) {
    const a = find(l.source);
    const b = find(l.target);
    if (a !== b) {
      parent.set(a, b);
      count -= 1;
    }
  }
  return count;
}
