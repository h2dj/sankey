import { useId, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChartModel } from '../../core/chartModel';
import { TEXT_DARK } from '../../core/palette';
import type { Settings } from '../../core/types';
import {
  BAND_FILL,
  BAND_LINE,
  NOTE_MARK_COLOR,
  PERIOD_MUTED,
  linkAriaLabel,
  linkKey,
  nodeAriaLabel,
  nodeKey,
  type ItemKey,
} from './items';

/** 화면 미리보기에서만 쓰는 상호작용. 내보내기에서는 넘기지 않는다. */
export interface ChartInteraction {
  /** 키보드 초점을 받을 요소(roving tabindex) */
  activeKey: ItemKey | null;
  /** null이면 강조 없음, 아니면 이 요소들만 진하게 */
  highlight: { links: Set<string>; nodes: Set<string> } | null;
  onPointerEnter(key: ItemKey, e: MouseEvent<SVGElement>): void;
  onPointerLeave(): void;
  onFocusItem(key: ItemKey, e: FocusEvent<SVGElement>): void;
  onBlurItem(): void;
  onActivate(key: ItemKey): void;
  onKeyDown(key: ItemKey, e: KeyboardEvent<SVGElement>): void;
  /** 노드를 두 번 누르면 그 노드의 메모 칸으로 */
  onNodeNote(nodeId: string): void;
  /** 시기 머리글을 눌러 고른 시기 */
  activePeriodId: string | null;
  onPeriodActivate(periodId: string): void;
}

interface Props {
  model: ChartModel;
  title: string;
  settings: Pick<Settings, 'fontSize' | 'showValues' | 'linkColor'>;
  interaction?: ChartInteraction;
}

const LINK_OPACITY = 0.45;
const LINK_OPACITY_DIM = 0.1;
const LINK_OPACITY_HI = 0.7;

/** 차트 모델을 SVG로 그린다. interaction이 없으면 정적인 SVG(내보내기용)가 된다. */
export function SankeyChart({ model, title, settings, interaction }: Props) {
  const uid = useId().replace(/:/g, '');
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const hi = interaction?.highlight ?? null;

  const itemProps = (key: ItemKey, label: string) =>
    interaction
      ? {
          tabIndex: interaction.activeKey === key ? 0 : -1,
          role: 'button',
          'aria-label': label,
          onMouseEnter: (e: MouseEvent<SVGElement>) => interaction.onPointerEnter(key, e),
          onMouseLeave: interaction.onPointerLeave,
          onFocus: (e: FocusEvent<SVGElement>) => interaction.onFocusItem(key, e),
          onBlur: interaction.onBlurItem,
          onClick: () => interaction.onActivate(key),
          onKeyDown: (e: KeyboardEvent<SVGElement>) => interaction.onKeyDown(key, e),
        }
      : {};

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={model.width}
      height={model.height}
      role={interaction ? 'group' : 'img'}
      aria-roledescription={interaction ? '생키 다이어그램' : undefined}
      aria-labelledby={`${titleId} ${descId}`}
      className="sankey-chart"
      fontSize={settings.fontSize}
      data-testid="sankey-chart"
    >
      <title id={titleId}>{title || '생키 다이어그램'}</title>
      <desc id={descId}>
        {`노드 ${model.nodes.length}개, 흐름 ${model.links.length}개. ` +
          model.links.map((l) => `${l.sourceLabel} → ${l.targetLabel} ${l.valueText}`).join(', ')}
      </desc>

      {settings.linkColor === 'gradient' && (
        <defs>
          {model.links.map((l, i) => (
            <linearGradient
              key={l.id}
              id={`${uid}-g${i}`}
              gradientUnits="userSpaceOnUse"
              x1={l.sx}
              x2={l.tx}
              y1={0}
              y2={0}
            >
              <stop offset="0%" stopColor={l.sourceColor} />
              <stop offset="100%" stopColor={l.targetColor} />
            </linearGradient>
          ))}
        </defs>
      )}

      {model.showBands && <PeriodBands model={model} />}

      <g className="links" fill="none">
        {model.links.map((l, i) => {
          const opacity = !hi
            ? LINK_OPACITY
            : hi.links.has(l.id)
              ? LINK_OPACITY_HI
              : LINK_OPACITY_DIM;
          return (
            <path
              key={l.id}
              d={l.path}
              stroke={settings.linkColor === 'gradient' ? `url(#${uid}-g${i})` : l.color}
              strokeOpacity={opacity}
              strokeWidth={l.width}
              data-link-id={l.id}
              data-source={l.source}
              data-target={l.target}
              {...itemProps(linkKey(l.id), linkAriaLabel(l))}
            >
              {!interaction && (
                <title>{`${l.sourceLabel} → ${l.targetLabel}: ${l.valueText}`}</title>
              )}
            </path>
          );
        })}
      </g>

      <g className="nodes">
        {model.nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x0}
            y={n.y0}
            width={n.x1 - n.x0}
            height={Math.max(1, n.y1 - n.y0)}
            fill={n.color}
            fillOpacity={hi && !hi.nodes.has(n.id) ? 0.35 : 1}
            data-node-id={n.id}
            {...itemProps(nodeKey(n.id), nodeAriaLabel(n))}
            onDoubleClick={interaction ? () => interaction.onNodeNote(n.id) : undefined}
          >
            {!interaction && <title>{`${n.label}: ${n.valueText}`}</title>}
          </rect>
        ))}
      </g>

      <g
        className="labels"
        fill={TEXT_DARK}
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinejoin="round"
        paintOrder="stroke"
        aria-hidden={interaction ? true : undefined}
        pointerEvents="none"
      >
        {model.nodes.map((n) => (
          <text
            key={n.id}
            x={n.labelX}
            y={n.labelY}
            dy="0.35em"
            textAnchor={n.labelAnchor}
            fillOpacity={hi && !hi.nodes.has(n.id) ? 0.45 : 1}
            data-label-for={n.id}
          >
            {n.label}
            {settings.showValues && <tspan fillOpacity={0.7}>{` ${n.valueText}`}</tspan>}
            {n.noteMark && (
              <tspan fill={NOTE_MARK_COLOR} fontWeight={600} data-note-mark={n.id}>
                {` ${n.noteMark}`}
              </tspan>
            )}
          </text>
        ))}
        {model.nodes
          .filter((n) => n.noteLines)
          .flatMap((n) =>
            n.noteLines!.map((line, i) => (
              <text
                key={`${n.id}-note-${i}`}
                x={n.labelX}
                y={n.labelY + settings.fontSize * (0.35 + 1.15 * (i + 1))}
                textAnchor={n.labelAnchor}
                fontSize={settings.fontSize * 0.85}
                fill={PERIOD_MUTED}
                fillOpacity={hi && !hi.nodes.has(n.id) ? 0.45 : 1}
                data-note-line={n.id}
              >
                {line}
              </text>
            )),
          )}
      </g>

      {model.periods.length > 0 && (
        <PeriodHeaders model={model} fontSize={settings.fontSize} interaction={interaction} />
      )}
    </svg>
  );
}

/** 시기 띠: 번갈아 칠하고 경계에 점선 */
function PeriodBands({ model }: { model: ChartModel }) {
  return (
    <g className="period-bands" aria-hidden="true" pointerEvents="none">
      {model.periods
        .filter((p) => p.shaded)
        .map((p) => (
          <rect
            key={p.id}
            x={p.x0}
            y={0}
            width={p.x1 - p.x0}
            height={model.height}
            fill={BAND_FILL}
          />
        ))}
      {model.periods
        .filter((p) => p.x0 > 0.5)
        .map((p) => (
          <line
            key={p.id}
            x1={p.x0}
            x2={p.x0}
            y1={0}
            y2={model.height}
            stroke={BAND_LINE}
            strokeDasharray="4 4"
          />
        ))}
    </g>
  );
}

/** 시기 머리글. 미리보기에서는 누르면 그 시기의 노드·흐름을 강조하는 단추가 된다. */
function PeriodHeaders({
  model,
  fontSize,
  interaction,
}: {
  model: ChartModel;
  fontSize: number;
  interaction: ChartInteraction | undefined;
}) {
  return (
    <g className="period-headers">
      {model.periods.map((p) => {
        const active = interaction?.activePeriodId === p.id;
        // 보이는 글자(시기 이름, 합계)로 시작해야 음성 명령·스크린리더 이름이 일치한다.
        const label = `${[p.label, p.totalsText].filter(Boolean).join(' ')} (시기, 노드 ${p.nodeIds.length}개)`;
        const content = (
          <>
            <rect
              x={p.x0 + 2}
              y={1}
              width={Math.max(0, p.x1 - p.x0 - 4)}
              height={model.headerHeight - 4}
              rx={4}
              fill={active ? '#DDF4FF' : 'transparent'}
              stroke={active ? '#2F6FB3' : 'none'}
            />
            <text
              x={p.cx}
              y={p.labelY}
              textAnchor="middle"
              fontWeight={600}
              fill={TEXT_DARK}
              data-period-label={p.id}
            >
              {p.label}
              {/* 합계와 이어 읽힐 때 띄어 쓰도록(접근 이름 = 보이는 글자) */}
              {p.totalsText ? ' ' : ''}
            </text>
            {p.totalsText && (
              <text
                x={p.cx}
                y={p.totalsY}
                textAnchor="middle"
                fontSize={fontSize * 0.85}
                fill={PERIOD_MUTED}
              >
                {p.totalsText}
              </text>
            )}
          </>
        );
        if (!interaction) return <g key={p.id}>{content}</g>;
        return (
          <g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={label}
            data-period-id={p.id}
            className="period-header"
            onClick={() => interaction.onPeriodActivate(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                interaction.onPeriodActivate(p.id);
              }
            }}
          >
            {content}
          </g>
        );
      })}
    </g>
  );
}
