import type { Issue, IssueLevel, RowField } from '../core/types';

export const LEVEL_ORDER: Record<IssueLevel, number> = { error: 0, warning: 1, info: 2 };

export interface RowIssues {
  /** 셀에 붙은 문제 */
  byField: Partial<Record<RowField, Issue[]>>;
  /** 셀을 특정하지 않는 행 단위 문제(중복, 순환 등) */
  row: Issue[];
  /** 이 행에서 가장 심각한 수준 */
  worst: IssueLevel | null;
}

/** 행 ID별로 문제를 묶는다. */
export function groupIssuesByRow(issues: readonly Issue[]): Map<string, RowIssues> {
  const map = new Map<string, RowIssues>();
  for (const issue of issues) {
    if (!issue.rowId) continue;
    let entry = map.get(issue.rowId);
    if (!entry) {
      entry = { byField: {}, row: [], worst: null };
      map.set(issue.rowId, entry);
    }
    if (issue.field) (entry.byField[issue.field] ??= []).push(issue);
    else entry.row.push(issue);
    if (entry.worst === null || LEVEL_ORDER[issue.level] < LEVEL_ORDER[entry.worst]) {
      entry.worst = issue.level;
    }
  }
  return map;
}

export const LEVEL_LABEL: Record<IssueLevel, string> = {
  error: '오류',
  warning: '경고',
  info: '안내',
};
