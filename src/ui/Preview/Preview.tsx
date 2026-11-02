import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ChartModel } from '../../core/chartModel';
import type { BuildResult, DiagramMeta, Row, Settings } from '../../core/types';
import { selectionStore, useSelection, type Selection } from '../../state/selection';
import { useElementWidth } from '../../hooks/useElementWidth';
import { track } from '../../state/observe';
import { focusCell } from '../focus';
import { ZOOM_STEPS, linkKey, nodeKey, splitKey, type ItemKey } from './items';
import { SankeyChart, type ChartInteraction } from './SankeyChart';
import { Tooltip, type TooltipState } from './Tooltip';
import { ZoomControls } from './ZoomControls';
import styles from './Preview.module.css';

interface Props {
  graph: BuildResult;
  model: ChartModel | null;
  meta: DiagramMeta;
  settings: Settings;
  rows: readonly Row[];
  /** 그릴 것이 없을 때 보일 다음 행동(가져오기·예시) */
  emptyActions?: ReactNode;
  /** 미리보기 영역의 너비(px). 차트를 이 너비로 그려 글자 크기가 화면에서도 그대로 보이게 한다. */
  onWidthChange?(width: number): void;
}

export function Preview({ onWidthChange, ...props }: Props) {
  const ref = useElementWidth<HTMLDivElement>((w) => onWidthChange?.(w));
  return (
    <div ref={ref}>
      <PreviewBody {...props} />
    </div>
  );
}

function PreviewBody({
  graph,
  model,
  meta,
  settings,
  rows,
  emptyActions,
}: Omit<Props, 'onWidthChange'>) {
  if (!graph.drawable || !model) {
    const blocking = graph.issues.find((i) => i.code === 'CYCLE');
    return (
      <div className={styles.empty} role="note">
        {blocking ? (
          <>
            <strong>다이어그램을 그릴 수 없습니다.</strong>
            <p>{blocking.message}</p>
          </>
        ) : (
          <>
            <p>출발 노드, 도착 노드, 값을 입력하면 다이어그램이 나타납니다.</p>
            {emptyActions && <div className={styles.emptyActions}>{emptyActions}</div>}
          </>
        )}
      </div>
    );
  }
  return <InteractiveChart model={model} meta={meta} settings={settings} rows={rows} />;
}

function InteractiveChart({
  model,
  meta,
  settings,
  rows,
}: {
  model: ChartModel;
  meta: DiagramMeta;
  settings: Settings;
  rows: readonly Row[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const zoom = ZOOM_STEPS[zoomIndex]!;
  const [hoverKey, setHoverKey] = useState<ItemKey | null>(null);
  const [activeKey, setActiveKey] = useState<ItemKey | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const selection = useSelection((s) => s.selection);

  // 키보드 이동 순서: 노드(왼쪽 열부터 위→아래), 그다음 흐름
  const order = useMemo<ItemKey[]>(() => {
    const nodes = [...model.nodes].sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
    return [...nodes.map((n) => nodeKey(n.id)), ...model.links.map((l) => linkKey(l.id))];
  }, [model]);
  // 지금 초점을 줄 요소: 마지막으로 초점이 있던 요소가 사라졌으면 첫 요소
  const currentKey = activeKey && order.includes(activeKey) ? activeKey : (order[0] ?? null);

  const rowNumber = useMemo(() => new Map(rows.map((r, i) => [r.id, i + 1])), [rows]);
  const linkById = useMemo(() => new Map(model.links.map((l) => [l.id, l])), [model]);
  const nodeById = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model]);

  const highlight = useMemo(() => {
    const fromKey = (key: ItemKey) => {
      const [kind, id] = splitKey(key);
      if (kind === 'link') {
        const l = linkById.get(id);
        return l ? { links: new Set([l.id]), nodes: new Set([l.source, l.target]) } : null;
      }
      return nodeById.has(id) ? incident(model, id) : null;
    };
    if (hoverKey) return fromKey(hoverKey);
    if (selection) return fromSelection(model, selection);
    return null;
  }, [hoverKey, selection, model, linkById, nodeById]);

  // 데이터가 바뀌어 요소가 사라졌으면 툴팁을 보이지 않는다.
  const visibleTooltip = tooltip && order.includes(tooltip.key) ? tooltip : null;

  const showTooltip = (key: ItemKey, anchor: { x: number; y: number }) => {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame) return;
    const x = anchor.x - frame.left;
    // 오른쪽 끝에서는 툴팁을 왼쪽으로 펼쳐 잘리지 않게 한다.
    setTooltip({ key, x, y: anchor.y - frame.top, flip: x > frame.width - 280 });
  };

  const activate = (key: ItemKey) => {
    const [kind, id] = splitKey(key);
    track('chart_select', { kind });
    if (kind === 'link') {
      const l = linkById.get(id);
      if (!l) return;
      selectionStore.getState().select({ rowIds: l.rowIds, linkId: l.id, from: 'chart' });
      focusCell(l.rowIds[0]!, 'value');
    } else {
      const n = nodeById.get(id);
      if (!n || n.rowIds.length === 0) return;
      selectionStore.getState().select({ rowIds: n.rowIds, nodeId: n.id, from: 'chart' });
      focusCell(n.rowIds[0]!, 'source');
    }
  };

  const focusKey = (key: ItemKey | undefined) => {
    if (!key) return;
    setActiveKey(key);
    const [kind, id] = splitKey(key);
    const attr = kind === 'link' ? 'data-link-id' : 'data-node-id';
    viewportRef.current
      ?.querySelector<SVGElement>(`[${attr}="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: false });
  };

  const interaction: ChartInteraction = {
    activeKey: currentKey,
    highlight,
    activePeriodId: selection?.periodId ?? null,
    onPeriodActivate: (periodId) => {
      const p = model.periods.find((x) => x.id === periodId);
      if (!p) return;
      track('chart_select', { kind: 'period' });
      if (selection?.periodId === periodId) selectionStore.getState().clear();
      else selectionStore.getState().select({ rowIds: p.rowIds, periodId, from: 'chart' });
    },
    onPointerEnter: (key, e) => {
      setHoverKey(key);
      showTooltip(key, { x: e.clientX, y: e.clientY });
    },
    onPointerLeave: () => {
      setHoverKey(null);
      setTooltip(null);
    },
    onFocusItem: (key, e) => {
      setActiveKey(key);
      setHoverKey(key);
      const r = e.currentTarget.getBoundingClientRect();
      showTooltip(key, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    onBlurItem: () => {
      setHoverKey(null);
      setTooltip(null);
    },
    onActivate: activate,
    onKeyDown: (key, e: KeyboardEvent<SVGElement>) => {
      const i = order.indexOf(key);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusKey(order[Math.min(order.length - 1, i + 1)]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusKey(order[Math.max(0, i - 1)]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusKey(order[0]);
      } else if (e.key === 'End') {
        e.preventDefault();
        focusKey(order.at(-1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(key);
      } else if (e.key === 'Escape') {
        selectionStore.getState().clear();
        setTooltip(null);
      }
    },
  };

  return (
    <div className={styles.frame} ref={frameRef}>
      <ZoomControls
        zoomIndex={zoomIndex}
        onZoom={setZoomIndex}
        fullscreenTarget={frameRef}
        hasSelection={selection !== null}
        onClearSelection={() => selectionStore.getState().clear()}
      />
      <div
        className={styles.viewport}
        ref={viewportRef}
        onClick={(e) => {
          // 빈 곳을 누르면 선택 해제
          if (e.target === e.currentTarget || (e.target as Element).tagName === 'svg') {
            selectionStore.getState().clear();
          }
        }}
      >
        {/* 좁은 화면에서는 최소 폭(560px)으로 그려 글자를 줄이지 않고 가로로 스크롤한다. */}
        <div
          className={styles.canvas}
          style={{ width: `${zoom * 100}%`, minWidth: `${model.width * zoom}px` }}
        >
          <SankeyChart
            model={model}
            title={meta.title}
            settings={settings}
            interaction={interaction}
          />
        </div>
      </div>
      {visibleTooltip && (
        <Tooltip
          state={visibleTooltip}
          link={linkById.get(itemId(visibleTooltip.key, 'link'))}
          node={nodeById.get(itemId(visibleTooltip.key, 'node'))}
          periods={model.periods}
          rowNumber={rowNumber}
        />
      )}
      {/* 스크린리더용: 차트의 흐름을 표로도 제공한다(T4.3). */}
      <div className="sr-only">
        <table>
          <caption>{`${meta.title || '생키 다이어그램'} 흐름 목록`}</caption>
          <thead>
            <tr>
              <th scope="col">출발 노드</th>
              <th scope="col">도착 노드</th>
              <th scope="col">값</th>
              <th scope="col">출발 노드에서 나가는 값 중 비율</th>
            </tr>
          </thead>
          <tbody>
            {model.links.map((l) => (
              <tr key={l.id}>
                <td>{l.sourceLabel}</td>
                <td>{l.targetLabel}</td>
                <td>{l.valueText}</td>
                <td>{Math.round(l.shareOfSource * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        흐름이나 노드를 누르면 해당 행으로 이동합니다. 키보드: Tab으로 차트에 들어가 방향키로 이동,
        Enter로 선택.
      </p>
      {(meta.description || meta.unit) && (
        <p className={styles.caption}>
          {meta.description}
          {meta.unit && <span className={styles.unit}>단위: {meta.unit}</span>}
        </p>
      )}
    </div>
  );
}

/** 키가 해당 종류면 ID, 아니면 빈 문자열(조회 실패) */
function itemId(key: ItemKey, kind: 'link' | 'node'): string {
  const [k, id] = splitKey(key);
  return k === kind ? id : '';
}

function incident(model: ChartModel, nodeId: string) {
  const links = new Set<string>();
  const nodes = new Set([nodeId]);
  for (const l of model.links) {
    if (l.source === nodeId || l.target === nodeId) {
      links.add(l.id);
      nodes.add(l.source);
      nodes.add(l.target);
    }
  }
  return { links, nodes };
}

function fromSelection(model: ChartModel, sel: Selection) {
  if (sel.nodeId) return incident(model, sel.nodeId);
  if (sel.periodId) {
    const p = model.periods.find((x) => x.id === sel.periodId);
    if (!p) return null;
    const nodes = new Set(p.nodeIds);
    const links = new Set(
      model.links.filter((l) => nodes.has(l.source) || nodes.has(l.target)).map((l) => l.id),
    );
    return { links, nodes };
  }
  const rows = new Set(sel.rowIds);
  const links = new Set<string>();
  const nodes = new Set<string>();
  for (const l of model.links) {
    if (l.rowIds.some((r) => rows.has(r))) {
      links.add(l.id);
      nodes.add(l.source);
      nodes.add(l.target);
    }
  }
  // 선택한 행이 그려지지 않는 행(오류·빈 행)이면 강조하지 않는다.
  return links.size > 0 ? { links, nodes } : null;
}
