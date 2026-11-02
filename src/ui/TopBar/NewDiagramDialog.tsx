import { useId, useState } from 'react';
import { createDoc } from '../../core/config';
import { announce } from '../../state/announce';
import { track } from '../../state/observe';
import { editorStore } from '../../state/store';
import { Dialog } from '../Dialog/Dialog';
import { focusCell } from '../focus';
import styles from '../ExportDialog/ExportDialog.module.css';

interface Props {
  onClose(): void;
  /** CSV로 먼저 보관하고 싶을 때 내려받기 창을 연다 */
  onExportFirst(): void;
}

/**
 * 새 다이어그램. 기획서 §4 사용 흐름 1단계(제목·값의 단위 설정)를 여기서 바로 받는다.
 */
export function NewDiagramDialog({ onClose, onExportFirst }: Props) {
  const titleId = useId();
  const unitId = useId();
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');

  const start = () => {
    const doc = createDoc({ meta: { title: title.trim(), unit: unit.trim() } });
    editorStore.getState().replaceDoc(doc);
    track('doc_new', { title: doc.meta.title !== '', unit: doc.meta.unit !== '' });
    announce('새 다이어그램을 시작했습니다. 실행 취소(Ctrl+Z)로 이전 작업을 되돌릴 수 있습니다.');
    onClose();
    // 창이 닫히고 초점이 돌아간 뒤 첫 칸으로 옮긴다.
    requestAnimationFrame(() => requestAnimationFrame(() => focusCell(doc.rows[0]!.id, 'source')));
  };

  return (
    <Dialog
      title="새 다이어그램"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onExportFirst();
            }}
          >
            먼저 CSV로 보관하기
          </button>
          <button type="button" className="primary" onClick={start}>
            지우고 새로 시작
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className={styles.field}>
          <label htmlFor={titleId}>제목(선택)</label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2027년 사업 예산 배분"
            data-autofocus
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={unitId}>값의 단위(선택)</label>
          <input
            id={unitId}
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="예: 백만 원, 명, kWh"
          />
          <span className={styles.hint}>
            단위는 여기에 한 번만 적고, 표의 값 칸에는 숫자만 입력합니다. 나중에 설정에서 바꿀 수
            있습니다.
          </span>
        </div>
        {/* Enter로 시작할 수 있도록 숨은 제출 버튼 */}
        <button type="submit" hidden />
      </form>
      <p className={styles.note}>
        지금 표와 설정을 지우고 빈 다이어그램으로 시작합니다. 이 브라우저에 자동 저장된 내용도 새
        작업으로 바뀝니다. 바로 뒤에는 실행 취소로 되돌릴 수 있지만, 새로고침하면 되돌릴 수
        없습니다.
      </p>
    </Dialog>
  );
}
