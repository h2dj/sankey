import type { RowField } from '../core/types';

/** 표의 특정 셀 입력란에 초점을 옮긴다. 셀이 없으면 false. */
export function focusCell(rowId: string, field: RowField = 'source'): boolean {
  const el = document.querySelector<HTMLInputElement>(
    `[data-row-id="${CSS.escape(rowId)}"][data-field="${field}"]`,
  );
  if (!el) return false;
  el.focus();
  el.select();
  return true;
}
