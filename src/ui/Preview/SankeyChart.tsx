import { useId, useMemo } from 'react';
import { formatWithUnit } from '../../core/format';
import { computeLayout, suggestHeight } from '../../core/layout';
import { assignColors } from '../../core/palette';
import type { BuildResult, DiagramMeta, Settings } from '../../core/types';

interface Props {
  graph: BuildResult;
  meta: DiagramMeta;
  settings: Settings;
  /** 논리 너비(px). 화면에서는 viewBox로 맞춰 늘고 줄어든다. */
  width?: number;
}

const LABEL_GAP = 6;

/** 레이아웃 결과를 SVG로 그린다. 내보내기(S3)도 이 SVG를 쓴다. */
export function SankeyChart({ graph, meta, settings, width = 960 }: Props) {
  const titleId = useId();
  const descId = useId();
  const height = suggestHeight(graph.nodes.length, settings);

  const layout = useMemo(
    () => computeLayout(graph, settings, { width, height }),
    [graph, settings, width, height],
  );

  const colors = useMemo(() => {
    const keyOf = (n: { id: string; group?: string }) =>
      settings.colorMode === 'group' ? (n.group ?? n.id) : n.id;
    const byKey = assignColors(layout.nodes.map(keyOf));
    return new Map(
      layout.nodes.map((n) => [n.id, settings.nodeColorOverrides[n.id] ?? byKey.get(keyOf(n))!]),
    );
  }, [layout, settings.colorMode, settings.nodeColorOverrides]);

  const labelOf = new Map(layout.nodes.map((n) => [n.id, n.label]));
  const fmt = (v: number) => formatWithUnit(v, meta.unit, settings.numberFormat);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className="sankey-chart"
      fontSize={settings.fontSize}
      data-testid="sankey-chart"
    >
      <title id={titleId}>{meta.title || '생키 다이어그램'}</title>
      <desc id={descId}>
        {`노드 ${layout.nodes.length}개, 흐름 ${layout.links.length}개. ` +
          layout.links
            .map((l) => `${labelOf.get(l.source)} → ${labelOf.get(l.target)} ${fmt(l.value)}`)
            .join(', ')}
      </desc>
      <g className="links" fill="none" strokeOpacity={0.4}>
        {layout.links.map((l) => (
          <path
            key={l.id}
            d={l.path}
            stroke={
              settings.linkColor === 'target'
                ? colors.get(l.target)
                : settings.linkColor === 'neutral'
                  ? '#8c959f'
                  : colors.get(l.source)
            }
            strokeWidth={l.width}
            data-link-id={l.id}
            data-source={l.source}
            data-target={l.target}
          >
            <title>{`${labelOf.get(l.source)} → ${labelOf.get(l.target)}: ${fmt(l.value)}`}</title>
          </path>
        ))}
      </g>
      <g className="nodes">
        {layout.nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x0}
            y={n.y0}
            width={n.x1 - n.x0}
            height={Math.max(1, n.y1 - n.y0)}
            fill={colors.get(n.id)}
            data-node-id={n.id}
          >
            <title>{`${n.label}: ${fmt(n.value)}`}</title>
          </rect>
        ))}
      </g>
      <g
        className="labels"
        fill="#1b1f24"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {layout.nodes.map((n) => {
          // 왼쪽 절반의 노드는 오른쪽에, 오른쪽 절반은 왼쪽에 레이블을 둔다.
          const leftHalf = (n.x0 + n.x1) / 2 < width / 2;
          return (
            <text
              key={n.id}
              x={leftHalf ? n.x1 + LABEL_GAP : n.x0 - LABEL_GAP}
              y={(n.y0 + n.y1) / 2}
              dy="0.35em"
              textAnchor={leftHalf ? 'start' : 'end'}
              data-label-for={n.id}
            >
              {n.label}
              {settings.showValues && <tspan fillOpacity={0.7}>{` ${fmt(n.value)}`}</tspan>}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
