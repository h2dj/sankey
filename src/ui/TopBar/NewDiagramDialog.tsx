import { createDoc } from '../../core/config';
import { announce } from '../../state/announce';
import { editorStore } from '../../state/store';
import { Dialog } from '../Dialog/Dialog';

interface Props {
  onClose(): void;
  /** CSV로 먼저 보관하고 싶을 때 내려받기 창을 연다 */
  onExportFirst(): void;
}

export function NewDiagramDialog({ onClose, onExportFirst }: Props) {
  const start = () => {
    editorStore.getState().replaceDoc(createDoc());
    announce('새 다이어그램을 시작했습니다. 실행 취소(Ctrl+Z)로 이전 작업을 되돌릴 수 있습니다.');
    onClose();
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
      <p style={{ margin: 0 }}>
        지금 표와 설정을 지우고 빈 다이어그램으로 시작합니다. 이 브라우저에 자동 저장된 내용도 새
        작업으로 바뀝니다.
      </p>
      <p style={{ margin: 0 }}>
        바로 뒤에는 실행 취소로 되돌릴 수 있지만, 새로고침하면 되돌릴 수 없습니다.
      </p>
    </Dialog>
  );
}
