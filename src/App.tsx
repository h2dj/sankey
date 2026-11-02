import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGraph } from './core/buildGraph';
import { DEFAULT_CHART_WIDTH, buildChartModel } from './core/chartModel';
import { LIMITS } from './core/config';
import { DEFAULT_SAMPLE_ID, loadSample } from './core/samples';
import { useDebounced } from './hooks/useDebounced';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useLayout, type PanelTab } from './state/layout';
import { PanelTabs } from './ui/PanelTabs/PanelTabs';
import { ko } from './i18n/ko';
import { selectionStore } from './state/selection';
import { announce } from './state/announce';
import { startAutosave } from './state/autosave';
import { browserStorage } from './state/initialDoc';
import { editorStore, startup, useEditor } from './state/store';
import { DataTable } from './ui/DataTable/DataTable';
import { IssueSummary } from './ui/IssueSummary/IssueSummary';
import { groupIssuesByRow } from './ui/issues';
import { Preview } from './ui/Preview/Preview';
import { SettingsPanel } from './ui/SettingsPanel/SettingsPanel';
import { TopBar } from './ui/TopBar/TopBar';
import { ExportDialog } from './ui/ExportDialog/ExportDialog';
import { ImportDialog } from './ui/ImportDialog/ImportDialog';
import { Toast } from './ui/Toast/Toast';
import { ObservePanel } from './ui/ObservePanel/ObservePanel';
import { issueKey } from './core/observe';
import { track } from './state/observe';
import type { BuildResult } from './core/types';
import { NewDiagramDialog } from './ui/TopBar/NewDiagramDialog';

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
  const [newOpen, setNewOpen] = useState(false);
  const openImport = () => {
    setDroppedFile(null);
    setImportOpen(true);
  };

  // 960px 미만: 데이터·미리보기·설정을 탭으로 나눈다(T4.2).
  const narrow = useMediaQuery('(max-width: 959px)');
  const tab = useLayout((s) => s.tab);
  const panelProps = (t: PanelTab) =>
    narrow
      ? { role: 'tabpanel', id: `tabpanel-${t}`, 'aria-labelledby': `tab-${t}`, hidden: tab !== t }
      : { 'aria-labelledby': `panel-${t}` };
  const errorCount = graph.issues.filter((i) => i.level === 'error').length;

  useUndoShortcuts();
  useAutosave();
  useGraphTracking(graph);

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">
        작업 영역으로 건너뛰기
      </a>
      <TopBar
        onNew={() => setNewOpen(true)}
        onImport={openImport}
        onExport={() => setExportOpen(true)}
      />
      {narrow && <PanelTabs errorCount={errorCount} />}
      <main className="workspace" id="workspace" tabIndex={-1}>
        <section
          className={dragOver ? 'panel panel--data panel--drop' : 'panel panel--data'}
          {...panelProps('data')}
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
        <section className="panel panel--preview" {...panelProps('preview')}>
          <h2 id="panel-preview">{ko.panel.preview}</h2>
          <Preview
            graph={graph}
            model={model}
            meta={settled.meta}
            settings={settled.settings}
            rows={settled.rows}
            onWidthChange={setPreviewWidth}
            emptyActions={
              <>
                <button type="button" onClick={openImport}>
                  CSV 가져오기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editorStore.getState().replaceDoc(loadSample(DEFAULT_SAMPLE_ID));
                    track('sample_loaded', { sample: DEFAULT_SAMPLE_ID, from: 'empty' });
                  }}
                >
                  예시 보기
                </button>
              </>
            }
          />
        </section>
        <section className="panel panel--settings" {...panelProps('settings')}>
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
      {newOpen && (
        <NewDiagramDialog
          onClose={() => setNewOpen(false)}
          onExportFirst={() => setExportOpen(true)}
        />
      )}
      <ObservePanel />
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

/** 브라우저 임시 저장 시작(F-07). 저장된 작업을 읽지 못했으면 알린다. */
function useAutosave() {
  useEffect(() => {
    const stop = startAutosave(browserStorage(), startup.load);
    if (startup.load.status === 'ok') track('restored');
    if (startup.load.status === 'invalid') announce(ko.save.invalid);
    return stop;
  }, []);
}

/**
 * 관찰 모드용: 다이어그램이 (다시) 그려진 때와 오류가 생기고 풀린 때를 기록한다.
 * 문제 내용(문장·이름)은 남기지 않고 코드만 남긴다.
 */
function useGraphTracking(graph: BuildResult) {
  const prev = useRef<{ drawable: boolean; errors: Map<string, string> } | null>(null);
  useEffect(() => {
    const errors = new Map(
      graph.issues.filter((i) => i.level === 'error').map((i) => [issueKey(i), i.code]),
    );
    const before = prev.current;
    if (graph.drawable && !before?.drawable) {
      track('chart_rendered', { nodes: graph.nodes.length, links: graph.links.length });
    }
    if (before) {
      for (const [k, code] of errors) if (!before.errors.has(k)) track('error_shown', { code });
      for (const [k, code] of before.errors) if (!errors.has(k)) track('error_resolved', { code });
    }
    prev.current = { drawable: graph.drawable, errors };
  }, [graph]);
}
