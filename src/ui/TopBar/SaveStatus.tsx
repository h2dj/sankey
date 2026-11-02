import { ko } from '../../i18n/ko';
import { useSaveState } from '../../state/autosave';
import styles from './TopBar.module.css';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

/** 자동 저장 상태와 저장 위치 안내(기획서 §11, 수용 기준 A8). */
export function SaveStatus() {
  const state = useSaveState();
  let text: string;
  let warn = false;
  switch (state.kind) {
    case 'idle':
      text = state.restoredAt ? ko.save.restored(time(state.restoredAt)) : ko.save.idle;
      break;
    case 'pending':
      text = ko.save.pending;
      break;
    case 'saved':
      text = ko.save.saved(time(state.savedAt));
      break;
    case 'error':
      text = state.reason === 'quota' ? ko.save.quota : ko.save.unavailable;
      warn = true;
      break;
  }

  return (
    <div className={styles.save}>
      <span className={warn ? styles.saveWarn : undefined} data-testid="save-status">
        {text}
      </span>
      <span aria-hidden="true"> · </span>
      <span>{ko.save.serverNote}</span>
      <details className={styles.saveHelp}>
        <summary>저장 안내</summary>
        <ul>
          {ko.save.help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
