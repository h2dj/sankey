import { useRef, type KeyboardEvent } from 'react';
import { ko } from '../../i18n/ko';
import { useLayout, type PanelTab } from '../../state/layout';
import { track } from '../../state/observe';
import styles from './PanelTabs.module.css';

const TABS: PanelTab[] = ['data', 'preview', 'settings'];

interface Props {
  /** 데이터 탭에 보일 오류 수 */
  errorCount: number;
}

/** 좁은 화면에서 데이터·미리보기·설정을 전환하는 탭(WAI-ARIA tabs 패턴). */
export function PanelTabs({ errorCount }: Props) {
  const tab = useLayout((s) => s.tab);
  const setTab = useLayout((s) => s.setTab);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    let next: PanelTab | undefined;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    else if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0];
    else if (e.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    track('tab_change', { tab: next });
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label="작업 화면" onKeyDown={onKeyDown}>
      {TABS.map((t) => (
        <button
          key={t}
          ref={(el) => {
            refs.current[t] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${t}`}
          aria-selected={tab === t}
          aria-controls={`tabpanel-${t}`}
          tabIndex={tab === t ? 0 : -1}
          className={styles.tab}
          aria-label={t === 'data' && errorCount > 0 ? `데이터, 오류 ${errorCount}건` : undefined}
          onClick={() => {
            setTab(t);
            track('tab_change', { tab: t });
          }}
        >
          {ko.panel[t]}
          {t === 'data' && errorCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {errorCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
