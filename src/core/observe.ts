/**
 * 사용성 테스트용 관찰 기록(기획서 §15 운영 지표, 계획 T5.2).
 * 입력 데이터·제목·노드 이름 같은 내용은 기록하지 않는다. 이벤트 값은 숫자·참거짓·
 * 짧은 영문 식별자만 허용하고, 그 밖의 값은 버린다(sanitizeProps).
 */

export const OBSERVE_EVENTS = [
  'session_start',
  'restored',
  'sample_loaded',
  'doc_new',
  'edit',
  'paste',
  'row_add',
  'row_delete',
  'undo',
  'redo',
  'import_ok',
  'import_fail',
  'export',
  'export_fail',
  'chart_rendered',
  'error_shown',
  'error_resolved',
  'chart_select',
  'tab_change',
  'settings_change',
  'task_start',
  'task_end',
] as const;

export type ObserveEventName = (typeof OBSERVE_EVENTS)[number];
export type ObserveProps = Record<string, string | number | boolean>;

export interface ObserveEvent {
  /** 관찰 시작부터 지난 시간(ms) */
  t: number;
  name: ObserveEventName;
  props?: ObserveProps;
}

const SAFE_STRING = /^[a-z0-9_.-]{1,32}$/i;

/** 내용이 섞일 수 있는 값은 버린다: 숫자·참거짓, 그리고 짧은 영문 식별자만 남긴다. */
export function sanitizeProps(
  props: Record<string, unknown> | undefined,
): ObserveProps | undefined {
  if (!props) return undefined;
  const out: ObserveProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (!SAFE_STRING.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && SAFE_STRING.test(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 같은 종류의 연속 이벤트(편집 등)를 하나로 합칠 시간(ms) */
export const MERGE_WINDOW_MS = 3000;
const MERGEABLE: ReadonlySet<ObserveEventName> = new Set(['edit', 'settings_change']);

/** 이벤트를 덧붙인다. 연속된 편집은 count를 늘려 하나로 합친다. */
export function appendEvent(events: readonly ObserveEvent[], next: ObserveEvent): ObserveEvent[] {
  const last = events.at(-1);
  if (
    last &&
    MERGEABLE.has(next.name) &&
    last.name === next.name &&
    next.t - last.t < MERGE_WINDOW_MS &&
    (next.name !== 'settings_change' || last.props?.key === next.props?.key)
  ) {
    const count = Number(last.props?.count ?? 1) + 1;
    return [...events.slice(0, -1), { ...last, t: next.t, props: { ...last.props, count } }];
  }
  return [...events, next];
}

export type TaskResult = 'success' | 'fail' | 'skip' | 'open';

export interface TaskSummary {
  task: number;
  result: TaskResult;
  durationMs: number;
  /** 과제 시작 뒤 처음 다이어그램이 그려지기까지(없으면 null) */
  firstChartMs: number | null;
  edits: number;
  errorsShown: number;
  errorsResolved: number;
  undos: number;
  imports: number;
  importFails: number;
  exports: string[];
}

/** 과제(task_start ~ task_end)별 지표 요약. 진행 중인 과제는 now까지로 계산한다. */
export function summarizeTasks(events: readonly ObserveEvent[], now: number): TaskSummary[] {
  const out: TaskSummary[] = [];
  let cur: (TaskSummary & { start: number }) | null = null;
  const close = (end: number, result: TaskResult) => {
    if (!cur) return;
    const { start, ...rest } = cur;
    out.push({ ...rest, result, durationMs: end - start });
    cur = null;
  };
  for (const e of events) {
    if (e.name === 'task_start') {
      close(e.t, 'open');
      cur = {
        task: Number(e.props?.task ?? out.length + 1),
        result: 'open',
        durationMs: 0,
        firstChartMs: null,
        edits: 0,
        errorsShown: 0,
        errorsResolved: 0,
        undos: 0,
        imports: 0,
        importFails: 0,
        exports: [],
        start: e.t,
      };
      continue;
    }
    if (!cur) continue;
    const c: TaskSummary & { start: number } = cur;
    switch (e.name) {
      case 'task_end':
        close(e.t, (e.props?.result as TaskResult) ?? 'open');
        break;
      case 'chart_rendered':
        if (c.firstChartMs === null) c.firstChartMs = e.t - c.start;
        break;
      case 'edit':
      case 'paste':
        c.edits += Number(e.props?.count ?? 1);
        break;
      case 'error_shown':
        c.errorsShown += 1;
        break;
      case 'error_resolved':
        c.errorsResolved += 1;
        break;
      case 'undo':
        c.undos += 1;
        break;
      case 'import_ok':
        c.imports += 1;
        break;
      case 'import_fail':
        c.importFails += 1;
        break;
      case 'export':
        c.exports.push(String(e.props?.format ?? '?'));
        break;
    }
  }
  if (cur) close(now, 'open');
  return out;
}

/** 문제 키(오류 표시·해결 추적용): 코드 + 행 + 칸. 내용은 넣지 않는다. */
export function issueKey(issue: {
  code: string;
  rowId?: string;
  field?: string;
  nodeName?: string;
}) {
  return `${issue.code}|${issue.rowId ?? ''}|${issue.field ?? ''}|${issue.nodeName ?? ''}`;
}
