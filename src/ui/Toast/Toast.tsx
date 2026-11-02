import { useEffect } from 'react';
import { announceStore, useAnnounce } from '../../state/announce';
import styles from './Toast.module.css';

/** 화면 아래 알림. 6초 뒤 사라지고, 스크린리더는 role=status로 읽는다. */
export function Toast() {
  const message = useAnnounce((s) => s.message);
  const seq = useAnnounce((s) => s.seq);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => announceStore.getState().dismiss(), 6000);
    return () => clearTimeout(t);
  }, [message, seq]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && (
        <div className={styles.toast} key={seq}>
          <span>{message}</span>
          <button
            type="button"
            onClick={() => announceStore.getState().dismiss()}
            aria-label="알림 닫기"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
