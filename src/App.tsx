import { useEffect, useMemo, useState } from 'react';
import { buildGraph } from './core/buildGraph';
import { DEFAULT_CHART_WIDTH, buildChartModel } from './core/chartModel';
import { LIMITS } from './core/config';
import { useDebounced } from './hooks/useDebounced';
import { ko } from './i18n/ko';
import { selectionStore } from './state/selection';
import { editorStore, useEditor } from './state/store';
import { DataTable } from './ui/DataTable/DataTable';
import { IssueSummary } from './ui/IssueSummary/IssueSummary';
import { groupIssuesByRow } from './ui/issues';
import { Preview } from './ui/Preview/Preview';
import { SettingsPanel } from './ui/SettingsPanel/SettingsPanel';
import { TopBar } from './ui/TopBar/TopBar';
import { ExportDialog } from './ui/ExportDialog/ExportDialog';
import { ImportDialog } from './ui/ImportDialog/ImportDialog';
import { Toast } from './ui/Toast/Toast';

/** 이보다 좁은 화면에서는 이 폭으로 그려 축소해 보인다(레이블 겹침 방지). */
const MIN_CHART_WIDTH = 560;

export function App() {
  const doc = useEditor((s) => s.doc);
  // 입력이 잠시 멈췄을 때만 다시 계산·그리기(계획 §3.2).
  const settled = useDebounced(doc, LIMITS.renderDebounceMs);

  const graph = useMemo(
    () => buildGraph(settled.rows, settled.settings),
    [settled.rows, settled.settings],
  );
  // 미리보기 폭에 맞춰 그린다. 너무 좁으면 최소 폭으로 그리고 화면에 맞춰 줄인다.
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_CHART_WIDTH);
  const chartWidth = Math.max(MIN_CHART_WIDTH, previewWidth - 2);
  const model = useMemo(
    () =>
      graph.drawable
        ? buildChartModel(graph, settled.rows, settled.meta, settled.settings, chartWidth)
        : null,
    [graph, settled.rows, settled.meta, settled.settings, chartWidth],
  );
  const issuesByRow = useMemo(() => groupIssuesByRow(graph.issues), [graph.issues]);

  const [importOpen, setImportOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useUndoShortcuts();

  return (
    <div className="app">
      <TopBar
        onImport={() => {
          setDroppedFile(null);
          setImportOpen(true);
        }}
        onExport={() => setExportOpen(true)}
      />
      <main className="workspace">
        <section
          className={dragOver ? 'panel panel--data panel--drop' : 'panel panel--data'}
          aria-labelledby="panel-data"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
          }}
          onDrop={(e) => {
            const file = e.dataTransfer.files[0];
            setDragOver(false);
            if (!file) return;
            e.preventDefault();
            setDroppedFile(file);
            setImportOpen(true);
          }}
        >
          <h2 id="panel-data">{ko.panel.data}</h2>
          <DataTable issuesByRow={issuesByRow} unit={doc.meta.unit} />
          <IssueSummary issues={graph.issues} rows={settled.rows} />
        </section>
        <section className="panel panel--preview" aria-labelledby="panel-preview">
          <h2 id="panel-preview">{ko.panel.preview}</h2>
          <Preview
            graph={graph}
            model={model}
            meta={settled.meta}
            settings={settled.settings}
            rows={settled.rows}
            onWidthChange={setPreviewWidth}
          />
        </section>
        <section className="panel panel--settings" aria-labelledby="panel-settings">
          <h2 id="panel-settings">{ko.panel.settings}</h2>
          <SettingsPanel model={model} />
        </section>
      </main>
      {importOpen && (
        <ImportDialog initialFile={droppedFile} onClose={() => setImportOpen(false)} />
      )}
      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          drawable={graph.drawable}
          previewWidth={chartWidth}
        />
      )}
      <Toast />
    </div>
  );
}

/** Ctrl/⌘+Z 실행 취소, Ctrl/⌘+Shift+Z·Ctrl+Y 다시 실행. 입력란의 기본 실행 취소 대신 문서 기록을 쓴다. */
function useUndoShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectionStore.getState().clear();
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const { undo, redo } = editorStore.getState();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
