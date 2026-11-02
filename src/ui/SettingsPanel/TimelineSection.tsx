import { useId } from 'react';
import type { ChartModel } from '../../core/chartModel';
import { newPeriodId } from '../../core/timeline';
import type { Period, Settings, TimelineSettings } from '../../core/types';
import { Checkbox } from './controls';
import styles from './SettingsPanel.module.css';

interface Props {
  timeline: TimelineSettings;
  model: ChartModel | null;
  onChange(patch: Partial<Settings>, opts?: { coalesce?: boolean }): void;
}

/**
 * 시기 축 배치 설정. 단계 깊이가 같아도 시기가 다른 노드를 실제 시기의 열에 놓는다.
 */
export function TimelineSection({ timeline, model, onChange }: Props) {
  const listId = useId();
  // 버튼·선택 조작은 실행 취소 한 단계씩, 시기 이름 입력만 연속 변경으로 묶는다.
  const set = (patch: Partial<TimelineSettings>, coalesce = false) =>
    onChange({ timeline: { ...timeline, ...patch } }, { coalesce });
  const { periods, nodePeriods } = timeline;

  const setPeriods = (next: Period[], coalesce = false) => {
    // 지운 시기에 지정된 노드는 "자동"으로 돌린다.
    const ids = new Set(next.map((p) => p.id));
    set(
      {
        periods: next,
        nodePeriods: Object.fromEntries(
          Object.entries(nodePeriods).filter(([, id]) => ids.has(id)),
        ),
      },
      coalesce,
    );
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...periods];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setPeriods(next);
  };
  const add = () => {
    const last = periods.at(-1)?.label ?? '';
    // "2019"처럼 숫자로 끝나면 다음 숫자를 제안한다.
    const m = /^(.*?)(\d+)(\D*)$/.exec(last);
    const label = m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : `시기 ${periods.length + 1}`;
    setPeriods([...periods, { id: newPeriodId(), label }]);
  };

  /** 지금 그려진 연결 단계(열)마다 시기를 하나씩 만들고 노드를 그 시기에 지정한다. */
  const fromDepth = () => {
    if (!model) return;
    const depths = [...new Set(model.nodes.map((n) => n.depth))].sort((a, b) => a - b);
    const made = depths.map((_, i) => ({ id: newPeriodId(), label: `${i + 1}단계` }));
    const byDepth = new Map(depths.map((d, i) => [d, made[i]!.id]));
    set({
      enabled: true,
      periods: made,
      nodePeriods: Object.fromEntries(model.nodes.map((n) => [n.id, byDepth.get(n.depth)!])),
    });
  };

  const nodes = model
    ? [...model.nodes].sort(
        (a, b) =>
          (a.periodIndex ?? 0) - (b.periodIndex ?? 0) || a.label.localeCompare(b.label, 'ko'),
      )
    : [];

  return (
    <>
      <Checkbox
        label="시기별로 배치(노드를 정한 시기의 열에 놓기)"
        checked={timeline.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      <p className={styles.muted}>
        연결 단계 수가 같아도 시기가 다르면 다른 열에 놓습니다. 시기마다 같은 폭을 차지하므로 노드가
        없는 시기도 간격으로 드러납니다.
      </p>

      {timeline.enabled && (
        <>
          <fieldset className={styles.nodeColors}>
            <legend>시기(시간 순서대로)</legend>
            {periods.length === 0 && (
              <p className={styles.muted}>
                시기를 추가하거나, 지금 연결 단계대로 시기를 만든 뒤 고쳐 쓰세요.
              </p>
            )}
            <ol className={styles.periodList}>
              {periods.map((p, i) => (
                <li key={p.id}>
                  <input
                    type="text"
                    value={p.label}
                    aria-label={`${i + 1}번째 시기 이름`}
                    onChange={(e) =>
                      setPeriods(
                        periods.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)),
                        true,
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`${p.label} 시기를 앞으로`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === periods.length - 1}
                    aria-label={`${p.label} 시기를 뒤로`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriods(periods.filter((x) => x.id !== p.id))}
                    aria-label={`${p.label} 시기 지우기`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <div className={styles.buttonRow}>
              <button type="button" onClick={add}>
                + 시기 추가
              </button>
              <button type="button" onClick={fromDepth} disabled={!model}>
                지금 단계로 시기 만들기
              </button>
            </div>
          </fieldset>

          {periods.length > 0 && model && (
            <fieldset className={styles.nodeColors}>
              <legend id={listId}>노드별 시기</legend>
              <p className={styles.muted}>
                "자동"은 연결된 노드를 따라 놓습니다. CSV의 출발 시기·도착 시기 열로 한꺼번에 정할
                수도 있습니다.
              </p>
              <ul aria-labelledby={listId}>
                {nodes.map((n) => {
                  const guess =
                    n.periodIndex !== undefined ? periods[n.periodIndex]?.label : undefined;
                  return (
                    <li key={n.id}>
                      <span className={styles.nodeName} title={n.label}>
                        {n.label}
                      </span>
                      <select
                        aria-label={`${n.label} 시기`}
                        value={nodePeriods[n.id] ?? ''}
                        onChange={(e) => {
                          const next = { ...nodePeriods };
                          if (e.target.value) next[n.id] = e.target.value;
                          else delete next[n.id];
                          set({ nodePeriods: next });
                        }}
                      >
                        <option value="">자동{guess ? ` (${guess})` : ''}</option>
                        {periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          <Checkbox
            label="시기 배경 띠와 경계선"
            checked={timeline.showBands}
            onChange={(showBands) => set({ showBands })}
          />
          <Checkbox
            label="시기마다 들어오고 나간 흐름 합계"
            checked={timeline.showTotals}
            onChange={(showTotals) => set({ showTotals })}
          />
        </>
      )}
    </>
  );
}
