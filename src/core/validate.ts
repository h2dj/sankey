import { LIMITS } from './config';
import { normalizeName, parseValue } from './normalize';
import type { Issue, Row, RowField } from './types';
import { ko } from '../i18n/ko';

/** 검증을 통과해 그래프에 쓸 수 있는 행 */
export interface ValidRow {
  rowId: string;
  /** 정규화된 이름 */
  source: string;
  target: string;
  /** 표시용 원문(앞뒤 공백만 제거) */
  sourceLabel: string;
  targetLabel: string;
  value: number;
  group?: string;
}

export interface ValidationResult {
  issues: Issue[];
  validRows: ValidRow[];
}

const REQUIRED_FIELDS = ['source', 'target', 'value'] as const satisfies readonly RowField[];

function isBlankRow(row: Row): boolean {
  return [row.source, row.target, row.value, row.group ?? '', row.memo ?? ''].every(
    (v) => v.trim() === '',
  );
}

/**
 * 행·셀 단위 검증(기획서 §5).
 * - 완전히 빈 행은 입력 중인 자리로 보고 오류를 내지 않는다.
 * - 오류가 있는 행은 validRows에서 빠지고, 나머지 행은 계속 그린다.
 * - 자기 자신으로 이어지는 행은 경고 후 제외한다.
 */
export function validate(
  rows: readonly Row[],
  limits: { maxRows: number; warnRows: number } = LIMITS,
): ValidationResult {
  const issues: Issue[] = [];
  const validRows: ValidRow[] = [];

  if (rows.length > limits.maxRows) {
    issues.push({ level: 'error', code: 'ROW_LIMIT', message: ko.issue.rowLimit(limits.maxRows) });
  } else if (rows.length > limits.warnRows) {
    issues.push({ level: 'warning', code: 'ROW_LIMIT', message: ko.issue.rowWarn(rows.length) });
  }

  for (const row of rows.slice(0, limits.maxRows)) {
    if (isBlankRow(row)) continue;
    let rowOk = true;

    for (const field of REQUIRED_FIELDS) {
      if (row[field].trim() === '') {
        rowOk = false;
        issues.push({
          level: 'error',
          code: 'REQUIRED',
          rowId: row.id,
          field,
          message: ko.issue.required(ko.columns[field]),
        });
      }
    }

    let value = 0;
    if (row.value.trim() !== '') {
      const parsed = parseValue(row.value);
      if (parsed.ok) {
        value = parsed.value;
      } else {
        rowOk = false;
        const message =
          parsed.code === 'NOT_POSITIVE'
            ? ko.issue.notPositive
            : parsed.code === 'NOT_FINITE'
              ? ko.issue.notFinite
              : ko.issue.notNumber(row.value.trim());
        issues.push({ level: 'error', code: parsed.code, rowId: row.id, field: 'value', message });
      }
    }

    const source = normalizeName(row.source);
    const target = normalizeName(row.target);
    if (source !== '' && source === target) {
      rowOk = false;
      issues.push({
        level: 'warning',
        code: 'SELF_LOOP',
        rowId: row.id,
        field: 'target',
        nodeName: source,
        message: ko.issue.selfLoop(row.source.trim()),
      });
    }

    if (rowOk) {
      const group = row.group?.trim();
      validRows.push({
        rowId: row.id,
        source,
        target,
        sourceLabel: row.source.trim(),
        targetLabel: row.target.trim(),
        value,
        ...(group ? { group } : {}),
      });
    }
  }

  return { issues, validRows };
}
