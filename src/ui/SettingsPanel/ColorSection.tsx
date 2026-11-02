import type { ChartModel } from '../../core/chartModel';
import { PALETTES } from '../../core/palette';
import type { Settings } from '../../core/types';
import { Radio } from './controls';
import styles from './SettingsPanel.module.css';

interface Props {
  settings: Settings;
  model: ChartModel | null;
  onChange(patch: Partial<Settings>): void;
}

export function ColorSection({ settings, model, onChange }: Props) {
  const overrides = settings.nodeColorOverrides;
  const hasOverrides = Object.keys(overrides).length > 0;

  const setNodeColor = (id: string, color: string | null) => {
    const next = { ...overrides };
    if (color === null) delete next[id];
    else next[id] = color.toUpperCase();
    onChange({ nodeColorOverrides: next });
  };

  return (
    <>
      <fieldset className={styles.radio}>
        <legend>팔레트</legend>
        {PALETTES.map((p) => (
          <label key={p.id} className={styles.palette}>
            <input
              type="radio"
              name="palette"
              value={p.id}
              checked={settings.paletteId === p.id}
              onChange={() => onChange({ paletteId: p.id })}
            />
            <span>{p.name}</span>
            <span className={styles.swatches} aria-hidden="true">
              {p.colors.slice(0, 8).map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
          </label>
        ))}
      </fieldset>

      <Radio
        legend="색을 나누는 기준"
        value={settings.colorMode}
        options={[
          ['node', '노드마다'],
          ['group', '색상 그룹마다'],
        ]}
        onChange={(colorMode) => onChange({ colorMode })}
      />

      <Radio
        legend="흐름 색"
        value={settings.linkColor}
        options={[
          ['source', '출발 노드 색'],
          ['target', '도착 노드 색'],
          ['gradient', '출발 → 도착 그라데이션'],
          ['neutral', '회색'],
        ]}
        onChange={(linkColor) => onChange({ linkColor })}
      />

      <fieldset className={styles.nodeColors}>
        <legend>노드별 색 지정</legend>
        {!model ? (
          <p className={styles.muted}>다이어그램이 그려지면 노드 목록이 나타납니다.</p>
        ) : (
          <ul>
            {model.nodes.map((n) => {
              const custom = overrides[n.id] !== undefined;
              return (
                <li key={n.id}>
                  <input
                    type="color"
                    value={n.color.toLowerCase()}
                    onChange={(e) => setNodeColor(n.id, e.target.value)}
                    aria-label={`${n.label} 색`}
                  />
                  <span className={styles.nodeName}>{n.label}</span>
                  {custom && (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => setNodeColor(n.id, null)}
                      aria-label={`${n.label} 색을 자동으로`}
                    >
                      자동
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hasOverrides && (
          <button type="button" onClick={() => onChange({ nodeColorOverrides: {} })}>
            직접 지정한 색 모두 지우기
          </button>
        )}
      </fieldset>
    </>
  );
}
