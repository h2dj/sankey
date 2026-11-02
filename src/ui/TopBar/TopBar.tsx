import { SAMPLES, loadSample } from '../../core/samples';
import { ko } from '../../i18n/ko';
import { editorStore, useEditor } from '../../state/store';
import styles from './TopBar.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

interface Props {
  onImport(): void;
  onExport(): void;
}

export function TopBar({ onImport, onExport }: Props) {
  const title = useEditor((s) => s.doc.meta.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo, replaceDoc } = editorStore.getState();

  return (
    <header className={styles.bar}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title || ko.app.untitled}</h1>
        <p className={styles.notice}>{ko.app.privacyNotice}</p>
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
        <button type="button" onClick={onImport}>
          CSV 가져오기
        </button>
        <button type="button" className="primary" onClick={onExport}>
          내려받기
        </button>
        <label className={styles.sample}>
          <span>예시 불러오기</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) replaceDoc(loadSample(e.target.value));
            }}
          >
            <option value="">선택…</option>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
