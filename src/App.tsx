import { useEffect, useMemo } from 'react';
import { buildGraph } from './core/buildGraph';
import { LIMITS } from './core/config';
import { useDebounced } from './hooks/useDebounced';
import { ko } from './i18n/ko';
import { editorStore, useEditor } from './state/store';
import { DataTable } from './ui/DataTable/DataTable';
import { IssueSummary } from './ui/IssueSummary/IssueSummary';
import { groupIssuesByRow } from './ui/issues';
import { Preview } from './ui/Preview/Preview';
import { TopBar } from './ui/TopBar/TopBar';

export function App() {
  const doc = useEditor((s) => s.doc);
  // 입력이 잠시 멈췄을 때만 다시 계산·그리기(계획 §3.2).
  const settled = useDebounced(doc, LIMITS.renderDebounceMs);

  const graph = useMemo(
    () => buildGraph(settled.rows, settled.settings),
    [settled.rows, settled.settings],
  );
  const issuesByRow = useMemo(() => groupIssuesByRow(graph.issues), [graph.issues]);

  useUndoShortcuts();

  return (
    <div className="app">
      <TopBar />
      <main className="workspace">
        <section className="panel" aria-labelledby="panel-data">
          <h2 id="panel-data">{ko.panel.data}</h2>
          <DataTable issuesByRow={issuesByRow} unit={doc.meta.unit} />
          <IssueSummary issues={graph.issues} rows={settled.rows} />
        </section>
        <section className="panel" aria-labelledby="panel-preview">
          <h2 id="panel-preview">{ko.panel.preview}</h2>
          <Preview graph={graph} meta={settled.meta} settings={settled.settings} />
        </section>
      </main>
    </div>
  );
}

/** Ctrl/⌘+Z 실행 취소, Ctrl/⌘+Shift+Z·Ctrl+Y 다시 실행. 입력란의 기본 실행 취소 대신 문서 기록을 쓴다. */
function useUndoShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
