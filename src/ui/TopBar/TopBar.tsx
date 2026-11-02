import { useState } from 'react';
import { SAMPLES, loadSample } from '../../core/samples';
import { ko } from '../../i18n/ko';
import { editorStore, useEditor } from '../../state/store';
import { SaveStatus } from './SaveStatus';
import styles from './TopBar.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

interface Props {
  onNew(): void;
  onImport(): void;
  onExport(): void;
}

export function TopBar({ onNew, onImport, onExport }: Props) {
  const title = useEditor((s) => s.doc.meta.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo, replaceDoc } = editorStore.getState();
  const [sampleId, setSampleId] = useState(SAMPLES[0]!.id);

  return (
    <header className={styles.bar}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title || ko.app.untitled}</h1>
        <SaveStatus />
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={undo} disabled={!canUndo} title={`실행 취소 (${MOD}Z)`}>
          실행 취소
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title={`다시 실행 (${MOD}Shift+Z)`}
        >
          다시 실행
        </button>
        <button type="button" onClick={onNew}>
          {ko.app.newDiagram}
        </button>
        <button type="button" onClick={onImport}>
          CSV 가져오기
        </button>
        <button type="button" className="primary" onClick={onExport}>
          내려받기
        </button>
        <div className={styles.sample}>
          {/* 선택과 불러오기를 나눠, 키보드 방향키로 고르는 중에 바로 불러오지 않게 한다. */}
          <label>
            <span className="sr-only">예시 데이터</span>
            <select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => replaceDoc(loadSample(sampleId))}>
            예시 불러오기
          </button>
        </div>
      </div>
    </header>
  );
}
