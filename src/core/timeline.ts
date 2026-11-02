import { createRow } from './config';
import type { GraphLink, GraphNode, Period, TimelineSettings } from './types';

/**
 * 시기 축 배치.
 * - 노드는 지정한 시기(nodePeriods)의 띠에 놓인다.
 * - 시기를 정하지 않은 노드는 연결을 따라 추정한다: 들어오는 흐름이 있으면 그 출발 노드들 중
 *   가장 늦은 시기, 없으면 나가는 흐름의 도착 노드들 중 가장 이른 시기, 그것도 없으면 첫 시기.
 * - 같은 시기 안에서 이어지는 노드는 하위 열로 나눠 왼쪽 → 오른쪽으로 놓는다.
 * - 도착 시기가 출발 시기보다 앞서면(시간을 거슬러 가는 흐름) backward에 모은다.
 */
export interface TimelinePlacement {
  periods: Period[];
  /** 노드 → 시기 번호(0부터) */
  period: Map<string, number>;
  /** 자동으로 추정한 노드 */
  inferred: Set<string>;
  /** 노드 → 시기 안 하위 열 번호(0부터) */
  sub: Map<string, number>;
  /** 시기마다 하위 열 수(노드가 없는 시기도 1) */
  subCount: number[];
  /** 시간을 거슬러 가는 흐름 */
  backward: GraphLink[];
}

export function timelineActive(t: TimelineSettings | undefined): t is TimelineSettings {
  return !!t && t.enabled && t.periods.length > 0;
}

/** 순환이 없을 때의 위상 순서. 순환이 있으면 null */
function topoOrder(nodes: readonly GraphNode[], links: readonly GraphLink[]): string[] | null {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const out = new Map<string, string[]>();
  for (const l of links) {
    indeg.set(l.target, (indeg.get(l.target) ?? 0) + 1);
    if (!out.has(l.source)) out.set(l.source, []);
    out.get(l.source)!.push(l.target);
  }
  // 입력 순서를 지키도록 앞에서부터 꺼낸다.
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const t of out.get(id) ?? []) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  return order.length === nodes.length ? order : null;
}

export function resolveTimeline(
  nodes: readonly GraphNode[],
  links: readonly GraphLink[],
  timeline: TimelineSettings,
): TimelinePlacement | null {
  if (!timelineActive(timeline)) return null;
  const order = topoOrder(nodes, links);
  if (!order) return null; // 순환은 buildGraph가 오류로 막는다

  const periods = timeline.periods;
  const indexOf = new Map(periods.map((p, i) => [p.id, i]));
  const incoming = new Map<string, GraphLink[]>();
  const outgoing = new Map<string, GraphLink[]>();
  for (const l of links) {
    (incoming.get(l.target) ?? incoming.set(l.target, []).get(l.target)!).push(l);
    (outgoing.get(l.source) ?? outgoing.set(l.source, []).get(l.source)!).push(l);
  }

  const period = new Map<string, number>();
  const inferred = new Set<string>();
  for (const n of nodes) {
    const idx = indexOf.get(timeline.nodePeriods[n.id] ?? '');
    if (idx !== undefined) period.set(n.id, idx);
  }

  // 앞으로: 출발 노드 중 가장 늦은 시기
  for (const id of order) {
    if (period.has(id)) continue;
    const from = (incoming.get(id) ?? [])
      .map((l) => period.get(l.source))
      .filter((p): p is number => p !== undefined);
    if (from.length > 0) {
      period.set(id, Math.max(...from));
      inferred.add(id);
    }
  }
  // 뒤로: 도착 노드 중 가장 이른 시기
  for (const id of [...order].reverse()) {
    if (period.has(id)) continue;
    const to = (outgoing.get(id) ?? [])
      .map((l) => period.get(l.target))
      .filter((p): p is number => p !== undefined);
    if (to.length > 0) {
      period.set(id, Math.min(...to));
      inferred.add(id);
    }
  }
  for (const n of nodes) {
    if (!period.has(n.id)) {
      period.set(n.id, 0);
      inferred.add(n.id);
    }
  }

  // 같은 시기 안 하위 열: 같은 시기에서 들어오는 흐름의 가장 긴 경로
  const sub = new Map<string, number>();
  for (const id of order) {
    const p = period.get(id)!;
    const s = (incoming.get(id) ?? [])
      .filter((l) => period.get(l.source) === p)
      .map((l) => (sub.get(l.source) ?? 0) + 1);
    sub.set(id, s.length > 0 ? Math.max(...s) : 0);
  }
  const subCount = periods.map(() => 1);
  for (const [id, s] of sub) {
    const p = period.get(id)!;
    subCount[p] = Math.max(subCount[p]!, s + 1);
  }

  const backward = links.filter((l) => period.get(l.target)! < period.get(l.source)!);
  return { periods, period, inferred, sub, subCount, backward };
}

/** 시기 이름 목록(입력 순서) → 시기 목록. 숫자가 섞인 이름은 자연스러운 순서로 정렬한다 */
export function periodsFromLabels(
  labels: readonly string[],
  existing: readonly Period[],
): Period[] {
  const out = [...existing];
  const known = new Set(existing.map((p) => p.label));
  const fresh = [...new Set(labels.map((l) => l.trim()).filter((l) => l && !known.has(l)))];
  fresh.sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
  for (const label of fresh) out.push({ id: newPeriodId(), label });
  return out;
}

export function newPeriodId(): string {
  return `p-${createRow().id.slice(0, 8)}`;
}
