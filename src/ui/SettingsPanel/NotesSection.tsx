import type { ChartModel } from '../../core/chartModel';
import { LIMITS } from '../../core/config';
import type { Settings } from '../../core/types';
import { editorStore, useEditor } from '../../state/store';
import { Radio } from './controls';
import styles from './SettingsPanel.module.css';

interface Props {
  noteDisplay: Settings['noteDisplay'];
  model: ChartModel | null;
  onChange(patch: Partial<Settings>): void;
}

/**
 * 노드 메모. 표의 "메모" 열(흐름 한 건에 붙는 편집용 메모)과 달리, 노드 자체에 붙어
 * 차트·내보낸 이미지에 보일 수 있다.
 */
export function NotesSection({ noteDisplay, model, onChange }: Props) {
  const notes = useEditor((s) => s.doc.nodeNotes);
  const count = model ? model.nodes.filter((n) => notes[n.id]?.trim()).length : 0;

  return (
    <>
      <Radio
        legend="메모를 보이는 방식"
        value={noteDisplay}
        options={[
          ['tooltip', '툴팁에만(마우스를 올리거나 초점을 둘 때)'],
          ['below', '레이블 아래에 작게(최대 2줄)'],
          ['footnote', '레이블에 번호, 차트 아래에 각주'],
        ]}
        onChange={(v) => onChange({ noteDisplay: v })}
      />
      <p className={styles.muted}>
        이미지로 내려받을 때도 고른 방식대로 들어갑니다. 차트에서 노드를 두 번 누르거나, 노드에
        초점을 두고 M을 누르면 여기로 옵니다.
      </p>

      {!model ? (
        <p className={styles.muted}>다이어그램이 그려지면 노드 목록이 나타납니다.</p>
      ) : (
        <fieldset className={styles.nodeColors}>
          <legend>
            노드별 메모{count > 0 && <span className={styles.muted}> · {count}개 작성</span>}
          </legend>
          <ul className={styles.noteList}>
            {model.nodes.map((n) => (
              <li key={n.id}>
                <label>
                  <span className={styles.nodeName}>
                    {n.label}
                    {n.noteMark && <span className={styles.muted}> {n.noteMark}</span>}
                  </span>
                  <textarea
                    rows={notes[n.id] ? 2 : 1}
                    maxLength={LIMITS.maxNoteLength}
                    value={notes[n.id] ?? ''}
                    placeholder="메모 없음"
                    data-note-for={n.id}
                    onChange={(e) => editorStore.getState().setNodeNote(n.id, e.target.value)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </>
  );
}
