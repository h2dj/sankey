import type { RowField } from '../core/types';
import { layoutStore } from '../state/layout';

const find = (rowId: string, field: RowField) =>
  document.querySelector<HTMLInputElement>(
    `[data-row-id="${CSS.escape(rowId)}"][data-field="${field}"]`,
  );

/**
 * 표의 특정 셀 입력란에 초점을 옮긴다. 셀이 없으면 false.
 * 좁은 화면에서 데이터 탭이 숨겨져 있으면 데이터 탭으로 바꾼 뒤 옮긴다.
 */
export function focusCell(rowId: string, field: RowField = 'source'): boolean {
  const el = find(rowId, field);
  if (!el) return false;
  if (el.offsetParent !== null) {
    el.focus();
    el.select();
    return true;
  }
  layoutStore.getState().setTab('data');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const shown = find(rowId, field);
      shown?.focus();
      shown?.select();
    }),
  );
  return true;
}
