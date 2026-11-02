import type { ChartLink, ChartNode, ChartPeriod } from '../../core/chartModel';
import type { ItemKey } from './items';
import styles from './Preview.module.css';

export interface TooltipState {
  key: ItemKey;
  /** 차트 틀 기준 좌표(px) */
  x: number;
  y: number;
  /** 왼쪽으로 펼치기 */
  flip: boolean;
}

interface Props {
  state: TooltipState;
  link?: ChartLink | undefined;
  node?: ChartNode | undefined;
  rowNumber: Map<string, number>;
  periods?: readonly ChartPeriod[];
}

function rowList(rowIds: readonly string[], rowNumber: Map<string, number>): string {
  const nums = rowIds.map((id) => rowNumber.get(id)).filter((n): n is number => n !== undefined);
  if (nums.length === 0) return '';
  const shown = nums.slice(0, 8).join(', ');
  return `${shown}${nums.length > 8 ? ` 외 ${nums.length - 8}개` : ''}행`;
}

/** 마우스를 올리거나 키보드 초점을 둔 흐름·노드의 정보. */
export function Tooltip({ state, link, node, rowNumber, periods = [] }: Props) {
  if (!link && !node) return null;
  return (
    <div
      className={state.flip ? `${styles.tooltip} ${styles.tooltipFlip}` : styles.tooltip}
      role="tooltip"
      style={{ left: state.x, top: state.y }}
      data-testid="chart-tooltip"
    >
      {link && (
        <>
          <strong>
            {link.sourceLabel} → {link.targetLabel}
          </strong>
          <span className={styles.tipValue}>{link.valueText}</span>
          <span>
            {link.sourceLabel}에서 나가는 값의 {Math.round(link.shareOfSource * 100)}%
          </span>
          <span className={styles.tipMuted}>{rowList(link.rowIds, rowNumber)}</span>
        </>
      )}
      {node && (
        <>
          <strong>{node.label}</strong>
          <span className={styles.tipValue}>{node.valueText}</span>
          {node.periodIndex !== undefined && periods[node.periodIndex] && (
            <span>
              시기: {periods[node.periodIndex]!.label}
              {node.periodInferred && ' (자동으로 놓음)'}
            </span>
          )}
          {node.inflow > 0 && node.outflow > 0 && (
            <span>
              들어옴 {fmtPlain(node.inflow)} · 나감 {fmtPlain(node.outflow)}
            </span>
          )}
          <span className={styles.tipMuted}>{rowList(node.rowIds, rowNumber)}</span>
        </>
      )}
    </div>
  );
}

function fmtPlain(v: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(v);
}
