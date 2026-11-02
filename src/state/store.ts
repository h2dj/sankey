import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { LIMITS, createRow } from '../core/config';
import { applyPaste, insertRow, removeRow, updateCell } from '../core/rows';
import { DEFAULT_SAMPLE_ID, loadSample } from '../core/samples';
import type { DiagramDoc, DiagramMeta, Row, RowField, Settings } from '../core/types';

const HISTORY_LIMIT = 100;
/** 같은 셀을 연달아 입력하면 이 시간 안의 변경은 실행 취소 한 번으로 묶는다. */
const COALESCE_MS = 1500;

export interface EditorState {
  doc: DiagramDoc;
  past: DiagramDoc[];
  future: DiagramDoc[];
  /** 직전 변경의 묶음 키와 시각(입력 묶기용) */
  lastEdit: { key: string; at: number } | null;
}

export interface EditorActions {
  setCell(rowId: string, field: RowField, value: string): void;
  /** 새 행 ID를 돌려준다. 행 수 제한이면 null. */
  addRow(afterId?: string): string | null;
  deleteRow(rowId: string): void;
  /** 붙여넣기. 버린 행 수를 돌려준다. */
  paste(startRowId: string, startField: RowField, matrix: string[][]): { droppedRows: number };
  setMeta(patch: Partial<DiagramMeta>): void;
  setSettings(patch: Partial<Settings>): void;
  /**
   * CSV에서 가져온 행을 넣는다. replace는 표를 바꾸고, append는 뒤에 붙인다.
   * unit이 있으면 replace일 때 또는 현재 단위가 비어 있을 때 단위도 바꾼다.
   * 행 수 제한으로 버린 행 수를 돌려준다. 실행 취소 한 번으로 되돌린다.
   */
  importRows(rows: Row[], mode: 'replace' | 'append', unit?: string): { dropped: number };
  /** 예시 불러오기 등 문서 전체 교체. 실행 취소로 되돌릴 수 있다. */
  replaceDoc(doc: DiagramDoc): void;
  undo(): void;
  redo(): void;
}

export type EditorStore = EditorState & EditorActions;

export function createEditorStore(
  initial: DiagramDoc = loadSample(DEFAULT_SAMPLE_ID),
  now = Date.now,
) {
  return createStore<EditorStore>()((set, get) => {
    /** 문서를 바꾸고 이전 상태를 기록한다. coalesceKey가 직전과 같고 시간 안이면 기록을 합친다. */
    const commit = (next: DiagramDoc, coalesceKey?: string) => {
      const { doc, past, lastEdit } = get();
      if (next === doc) return;
      const t = now();
      const merge =
        coalesceKey !== undefined && lastEdit?.key === coalesceKey && t - lastEdit.at < COALESCE_MS;
      set({
        doc: { ...next, updatedAt: new Date(t).toISOString() },
        past: merge ? past : [...past, doc].slice(-HISTORY_LIMIT),
        future: [],
        lastEdit: coalesceKey !== undefined ? { key: coalesceKey, at: t } : null,
      });
    };
    const withRows = (rows: DiagramDoc['rows']) => ({ ...get().doc, rows });

    return {
      doc: initial,
      past: [],
      future: [],
      lastEdit: null,

      setCell(rowId, field, value) {
        const { doc } = get();
        const row = doc.rows.find((r) => r.id === rowId);
        if (!row || (row[field] ?? '') === value) return;
        commit(withRows(updateCell(doc.rows, rowId, field, value)), `cell:${rowId}:${field}`);
      },

      addRow(afterId) {
        const res = insertRow(get().doc.rows, afterId, LIMITS.maxRows);
        if (!res) return null;
        commit(withRows(res.rows));
        return res.row.id;
      },

      deleteRow(rowId) {
        commit(withRows(removeRow(get().doc.rows, rowId)));
      },

      paste(startRowId, startField, matrix) {
        const res = applyPaste(get().doc.rows, startRowId, startField, matrix, LIMITS.maxRows);
        if (res.touchedRowIds.length > 0) commit(withRows(res.rows));
        return { droppedRows: res.droppedRows };
      },

      setMeta(patch) {
        const { doc } = get();
        const keys = Object.keys(patch).sort().join(',');
        commit({ ...doc, meta: { ...doc.meta, ...patch } }, `meta:${keys}`);
      },

      setSettings(patch) {
        const { doc } = get();
        // 슬라이더·색 선택기를 끄는 동안의 연속 변경은 한 번의 실행 취소로 묶는다.
        const keys = Object.keys(patch).sort().join(',');
        commit({ ...doc, settings: { ...doc.settings, ...patch } }, `settings:${keys}`);
      },

      importRows(rows, mode, unit) {
        const { doc } = get();
        const kept = mode === 'append' ? doc.rows.filter((r) => !isBlank(r)) : [];
        const room = Math.max(0, LIMITS.maxRows - kept.length);
        const added = rows.slice(0, room);
        const nextRows = [...kept, ...added];
        const setUnit = unit && (mode === 'replace' || !doc.meta.unit.trim());
        commit({
          ...doc,
          rows: nextRows.length > 0 ? nextRows : [createRow()],
          meta: setUnit ? { ...doc.meta, unit } : doc.meta,
        });
        return { dropped: rows.length - added.length };
      },

      replaceDoc(next) {
        commit(next);
      },

      undo() {
        const { doc, past, future } = get();
        const prev = past.at(-1);
        if (!prev) return;
        set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], lastEdit: null });
      },

      redo() {
        const { doc, past, future } = get();
        const next = future[0];
        if (!next) return;
        set({ doc: next, past: [...past, doc], future: future.slice(1), lastEdit: null });
      },
    };
  });
}

export const editorStore = createEditorStore();

export function useEditor<T>(selector: (s: EditorStore) => T): T {
  return useStore(editorStore, selector);
}

function isBlank(r: Row): boolean {
  return [r.source, r.target, r.value, r.group ?? '', r.memo ?? ''].every((v) => v.trim() === '');
}
