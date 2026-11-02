import { LIMITS, createRow } from './config';
import type { Row, RowField } from './types';

/** 표 열 순서. 붙여넣기·CSV 열 매핑의 기준. */
export const COLUMNS: readonly RowField[] = ['source', 'target', 'value', 'group', 'memo'];

export function updateCell(
  rows: readonly Row[],
  rowId: string,
  field: RowField,
  value: string,
): Row[] {
  return rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r));
}

/** afterId 다음(없으면 맨 끝)에 빈 행을 넣는다. 행 수 제한을 넘으면 null. */
export function insertRow(
  rows: readonly Row[],
  afterId?: string,
  maxRows: number = LIMITS.maxRows,
): { rows: Row[]; row: Row } | null {
  if (rows.length >= maxRows) return null;
  const row = createRow();
  const idx = afterId === undefined ? -1 : rows.findIndex((r) => r.id === afterId);
  const at = idx === -1 ? rows.length : idx + 1;
  return { rows: [...rows.slice(0, at), row, ...rows.slice(at)], row };
}

/** 행을 지운다. 마지막 한 행은 지우지 않고 비운다(표가 사라지지 않도록). */
export function removeRow(rows: readonly Row[], rowId: string): Row[] {
  if (rows.length === 1 && rows[0]!.id === rowId) return [createRow()];
  return rows.filter((r) => r.id !== rowId);
}

/**
 * 엑셀·스프레드시트에서 복사한 표(탭 구분)를 2차원 배열로.
 * 셀 하나만 복사한 경우(탭·줄바꿈 없음)는 null을 돌려 기본 붙여넣기에 맡긴다.
 */
export function parseClipboardTable(text: string): string[][] | null {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (!normalized.includes('\t') && !normalized.includes('\n')) return null;
  return normalized.split('\n').map((line) => line.split('\t').map(unquoteCell));
}

/** 엑셀은 줄바꿈·따옴표가 든 셀을 "..."로 감싸 복사한다. 단순한 경우만 벗긴다. */
function unquoteCell(cell: string): string {
  const m = /^"(.*)"$/s.exec(cell);
  return m ? m[1]!.replaceAll('""', '"') : cell;
}

export interface PasteResult {
  rows: Row[];
  /** 값이 들어간 행 ID(첫 행부터) */
  touchedRowIds: string[];
  /** 행 수 제한 때문에 버린 행 수 */
  droppedRows: number;
}

/**
 * (startRowId, startField) 셀부터 오른쪽·아래로 채운다.
 * 표 끝을 넘으면 새 행을 만들고, 오른쪽 열 밖의 값은 버린다.
 */
export function applyPaste(
  rows: readonly Row[],
  startRowId: string,
  startField: RowField,
  matrix: readonly (readonly string[])[],
  maxRows: number = LIMITS.maxRows,
): PasteResult {
  const next = [...rows];
  const startRow = next.findIndex((r) => r.id === startRowId);
  const startCol = COLUMNS.indexOf(startField);
  if (startRow === -1 || startCol === -1) return { rows: next, touchedRowIds: [], droppedRows: 0 };

  const touchedRowIds: string[] = [];
  let droppedRows = 0;

  matrix.forEach((cells, i) => {
    const at = startRow + i;
    if (at >= next.length) {
      if (next.length >= maxRows) {
        droppedRows += 1;
        return;
      }
      next.push(createRow());
    }
    const updated = { ...next[at]! };
    cells.forEach((cell, j) => {
      const field = COLUMNS[startCol + j];
      if (field) updated[field] = cell.trim();
    });
    next[at] = updated;
    touchedRowIds.push(updated.id);
  });

  return { rows: next, touchedRowIds, droppedRows };
}
