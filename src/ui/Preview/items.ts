import type { ChartLink, ChartNode } from '../../core/chartModel';

/** 차트 안에서 초점·강조 대상이 되는 요소의 키 */
export type ItemKey = `link:${string}` | `node:${string}`;

export const linkKey = (id: string): ItemKey => `link:${id}`;
export const nodeKey = (id: string): ItemKey => `node:${id}`;

export function splitKey(key: ItemKey): ['link' | 'node', string] {
  const i = key.indexOf(':');
  return [key.slice(0, i) as 'link' | 'node', key.slice(i + 1)];
}

export function linkAriaLabel(l: ChartLink): string {
  const pct = Math.round(l.shareOfSource * 100);
  return `${l.sourceLabel} → ${l.targetLabel}, ${l.valueText} (${l.sourceLabel}에서 나가는 값의 ${pct}%)`;
}

export function nodeAriaLabel(n: ChartNode): string {
  return `${n.label}${n.noteMark ? ` ${n.noteMark}` : ''}, ${n.valueText}${n.note ? `, 메모: ${n.note}` : ''}`;
}

/** 각주 번호·메모 줄 색 */
export const NOTE_MARK_COLOR = '#2F6FB3';

/** 미리보기 확대 단계 */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

/** 시기 띠 색(내보내기 core/svgDocument.ts와 같은 값) */
export const BAND_FILL = '#EEF2F7';
export const BAND_LINE = '#C9D1D9';
export const PERIOD_MUTED = '#57606A';
