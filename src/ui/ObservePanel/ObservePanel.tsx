import { useEffect, useState } from 'react';
import { summarizeTasks, type TaskSummary } from '../../core/observe';
import { downloadBlob } from '../../export/download';
import {
  clearObservation,
  observeStore,
  stopObservation,
  track,
  useObserve,
} from '../../state/observe';
import styles from './ObservePanel.module.css';

const fmt = (ms: number | null) => {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const RESULT_LABEL: Record<TaskSummary['result'], string> = {
  success: '성공',
  fail: '실패',
  skip: '건너뜀',
  open: '진행 중',
};

/** 사용성 테스트 진행자용 패널(?observe=1). 입력 데이터 내용은 기록하지 않는다. */
export function ObservePanel() {
  const enabled = useObserve((s) => s.enabled);
  const events = useObserve((s) => s.events);
  const startedAt = useObserve((s) => s.startedAt);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [taskNo, setTaskNo] = useState(1);

  useEffect(() => {
    if (!enabled) return;
    if (observeStore.getState().events.length === 0) track('session_start');
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  if (!enabled) return null;

  const tasks = summarizeTasks(events, now - startedAt);
  const current = tasks.at(-1)?.result === 'open' ? tasks.at(-1) : undefined;

  const end = (result: 'success' | 'fail' | 'skip') => {
    track('task_end', { result });
    setTaskNo((n) => Math.min(9, n + 1));
  };

  const download = () => {
    const state = observeStore.getState();
    const payload = {
      format: 'sankey-maker-observation/1',
      startedAt: new Date(state.startedAt).toISOString(),
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      tasks: summarizeTasks(state.events, Date.now() - state.startedAt),
      events: state.events,
    };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `observation-${stamp}.json`,
    );
  };

  return (
    <section className={styles.panel} aria-label="관찰 모드" data-testid="observe-panel">
      <header className={styles.header}>
        <strong>관찰 모드</strong>
        <span className={styles.muted}>내용은 기록하지 않음</span>
        <button
          type="button"
          className={styles.small}
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? '펼치기' : '접기'}
        </button>
      </header>
      {!collapsed && (
        <>
          <div className={styles.row}>
            {current ? (
              <>
                <span>
                  과제 {current.task} · <b data-testid="observe-timer">{fmt(current.durationMs)}</b>
                </span>
                <button type="button" onClick={() => end('success')}>
                  성공
                </button>
                <button type="button" onClick={() => end('fail')}>
                  실패
                </button>
                <button type="button" onClick={() => end('skip')}>
                  건너뜀
                </button>
              </>
            ) : (
              <>
                <label>
                  과제{' '}
                  <select value={taskNo} onChange={(e) => setTaskNo(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={() => track('task_start', { task: taskNo })}
                >
                  시작
                </button>
              </>
            )}
          </div>
          {tasks.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">과제</th>
                  <th scope="col">결과</th>
                  <th scope="col">시간</th>
                  <th scope="col">첫 차트</th>
                  <th scope="col">오류(해결)</th>
                  <th scope="col">내려받기</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={i}>
                    <td>{t.task}</td>
                    <td>{RESULT_LABEL[t.result]}</td>
                    <td>{fmt(t.durationMs)}</td>
                    <td>{fmt(t.firstChartMs)}</td>
                    <td>
                      {t.errorsShown}({t.errorsResolved})
                    </td>
                    <td>{t.exports.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={styles.row}>
            <button type="button" onClick={download}>
              기록 내려받기
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('관찰 기록을 지우고 새로 시작할까요?')) clearObservation();
              }}
            >
              기록 지우기
            </button>
            <button type="button" onClick={stopObservation}>
              관찰 끝내기
            </button>
          </div>
        </>
      )}
    </section>
  );
}
