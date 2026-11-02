import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { LIMITS } from '../../core/config';
import { COLUMNS, parseClipboardTable } from '../../core/rows';
import type { Issue, Row, RowField } from '../../core/types';
import { ko } from '../../i18n/ko';
import { editorStore, useEditor } from '../../state/store';
import { focusCell } from '../focus';
import { LEVEL_LABEL, type RowIssues } from '../issues';
import styles from './DataTable.module.css';

interface Props {
  issuesByRow: Map<string, RowIssues>;
  unit: string;
}

type FocusTarget = { rowId: string; field: RowField };

const isMod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

export function DataTable({ issuesByRow, unit }: Props) {
  const rows = useEditor((s) => s.doc.rows);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const [status, setStatus] = useState('');

  // 행 추가·삭제 뒤 새로 그려진 셀로 초점을 옮긴다.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target && focusCell(target.rowId, target.field)) pendingFocus.current = null;
  }, [rows]);

  const atLimit = rows.length >= LIMITS.maxRows;

  // 핸들러는 렌더 시점의 rows가 아니라 저장소의 최신 상태를 읽는다.
  // 그래야 콜백이 안정적이어서 RowView 메모이제이션이 동작한다.
  const handlers = useMemo(() => {
    const getRows = () => editorStore.getState().doc.rows;

    const addRowAfter = (afterId: string | undefined, field: RowField = 'source') => {
      const id = editorStore.getState().addRow(afterId);
      if (id) pendingFocus.current = { rowId: id, field };
      else setStatus(ko.issue.rowLimit(LIMITS.maxRows));
    };

    const deleteRow = (rowId: string, field: RowField = 'source') => {
      const idx = getRows().findIndex((r) => r.id === rowId);
      editorStore.getState().deleteRow(rowId);
      const after = getRows();
      const next = after[Math.min(idx, after.length - 1)];
      if (next) pendingFocus.current = { rowId: next.id, field };
      setStatus(`${idx + 1}행을 삭제했습니다. Ctrl+Z로 되돌릴 수 있습니다.`);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: RowField) => {
      const rows = getRows();
      const index = rows.findIndex((r) => r.id === rowId);
      const move = (to: number) => {
        const target = rows[to];
        if (target) focusCell(target.id, field);
      };

      if (e.key === 'Enter' && isMod(e)) {
        e.preventDefault();
        addRowAfter(rowId);
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        move(index - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (index === rows.length - 1) addRowAfter(rowId, field);
        else move(index + 1);
      } else if (e.key === 'ArrowDown' && !e.altKey) {
        e.preventDefault();
        move(index + 1);
      } else if (e.key === 'ArrowUp' && !e.altKey) {
        e.preventDefault();
        move(index - 1);
      } else if (e.key === 'Delete' && isMod(e)) {
        e.preventDefault();
        deleteRow(rowId, field);
      }
    };

    const onPaste = (e: ClipboardEvent<HTMLInputElement>, rowId: string, field: RowField) => {
      const matrix = parseClipboardTable(e.clipboardData.getData('text/plain'));
      if (!matrix) return; // 셀 하나: 기본 붙여넣기
      e.preventDefault();
      const { droppedRows } = editorStore.getState().paste(rowId, field, matrix);
      const pasted = matrix.length - droppedRows;
      setStatus(
        droppedRows > 0
          ? `${pasted}행을 붙여넣었습니다. 최대 ${LIMITS.maxRows}행을 넘는 ${droppedRows}행은 제외했습니다.`
          : `${pasted}행을 붙여넣었습니다.`,
      );
    };

    return { addRowAfter, deleteRow, onKeyDown, onPaste };
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        <table className={styles.table} aria-label="흐름 데이터" aria-describedby="table-help">
          <thead>
            <tr>
              <th scope="col" className={styles.num}>
                <span className="sr-only">행 번호</span>#
              </th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className={styles[`col_${c}`]}>
                  {ko.columns[c]}
                  {c === 'value' && unit && <span className={styles.unit}> ({unit})</span>}
                  {(c === 'source' || c === 'target' || c === 'value') && (
                    <span className={styles.required} aria-label="필수">
                      *
                    </span>
                  )}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">행 삭제</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <RowView
                key={row.id}
                row={row}
                index={i}
                issues={issuesByRow.get(row.id)}
                onKeyDown={handlers.onKeyDown}
                onPaste={handlers.onPaste}
                onDelete={handlers.deleteRow}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => handlers.addRowAfter(undefined)} disabled={atLimit}>
          + 행 추가
        </button>
        <span className={styles.count}>
          {rows.length} / {LIMITS.maxRows}행
        </span>
      </div>
      <p className={styles.status} role="status">
        {status}
      </p>
      <p id="table-help" className={styles.help}>
        Enter 아래 행 · Shift+Enter 위 행 · Ctrl+Enter 행 추가 · Ctrl+Delete 행 삭제 · Ctrl+Z 실행
        취소. 엑셀에서 복사한 표를 셀에 붙여넣을 수 있습니다.
      </p>
    </div>
  );
}

interface RowViewProps {
  row: Row;
  index: number;
  issues: RowIssues | undefined;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: RowField) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>, rowId: string, field: RowField) => void;
  onDelete: (rowId: string) => void;
}

function issueText(list: readonly Issue[] | undefined) {
  return list?.map((i) => `${LEVEL_LABEL[i.level]}: ${i.message}`).join(' ') ?? '';
}

const RowView = memo(
  function RowView({ row, index, issues, onKeyDown, onPaste, onDelete }: RowViewProps) {
    const n = index + 1;
    const rowNote = issueText(issues?.row);
    return (
      <tr className={issues?.worst ? styles[`row_${issues.worst}`] : undefined} data-row={n}>
        <th scope="row" className={styles.num}>
          {n}
          {rowNote && (
            <span className={styles.rowMark} title={rowNote}>
              <span aria-hidden="true">●</span>
              <span className="sr-only">{rowNote}</span>
            </span>
          )}
        </th>
        {COLUMNS.map((field) => {
          const cellIssues = issues?.byField[field];
          const worst = cellIssues?.find((i) => i.level === 'error') ?? cellIssues?.[0];
          const descId = cellIssues ? `cell-${row.id}-${field}-issue` : undefined;
          return (
            <td key={field} className={styles.cell}>
              <input
                className={worst ? styles[`input_${worst.level}`] : undefined}
                value={row[field] ?? ''}
                onChange={(e) => editorStore.getState().setCell(row.id, field, e.target.value)}
                onKeyDown={(e) => onKeyDown(e, row.id, field)}
                onPaste={(e) => onPaste(e, row.id, field)}
                aria-label={`${n}행 ${ko.columns[field]}`}
                aria-invalid={worst?.level === 'error' ? true : undefined}
                aria-describedby={descId}
                title={worst?.message}
                inputMode={field === 'value' ? 'decimal' : undefined}
                autoComplete="off"
                spellCheck={false}
                data-row-id={row.id}
                data-field={field}
              />
              {descId && (
                <span id={descId} className="sr-only">
                  {issueText(cellIssues)}
                </span>
              )}
            </td>
          );
        })}
        <td className={styles.actions}>
          <button
            type="button"
            className={styles.delete}
            onClick={() => onDelete(row.id)}
            aria-label={`${n}행 삭제`}
            title={`${n}행 삭제`}
          >
            ×
          </button>
        </td>
      </tr>
    );
  },
  (a, b) => a.row === b.row && a.index === b.index && sameIssues(a.issues, b.issues),
);

function sameIssues(a: RowIssues | undefined, b: RowIssues | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const flat = (x: RowIssues) =>
    [
      ...Object.entries(x.byField).flatMap(([f, l]) => l.map((i) => f + i.code + i.message)),
      ...x.row.map((i) => i.code + i.message),
    ].join('|');
  return flat(a) === flat(b);
}
