import { normalizeName } from './normalize';
import type { Row, Settings } from './types';

export interface Palette {
  id: string;
  name: string;
  colors: readonly string[];
}

/**
 * 모든 팔레트 색은 흰 배경 대비 3:1 이상(노드 막대 식별용, 단위 테스트로 확인).
 * 기본 팔레트는 Okabe–Ito 색각 이상 고려 팔레트를 어둡게 조정한 것이다.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: 'default',
    name: '기본(색각 이상 고려)',
    colors: [
      '#0072B2',
      '#C26A00',
      '#00876A',
      '#B3478C',
      '#3A86C8',
      '#C24E00',
      '#7A6F00',
      '#6B6B6B',
    ],
  },
  {
    id: 'muted',
    name: '차분한',
    colors: [
      '#4E79A7',
      '#D9711C',
      '#C2464A',
      '#4D9A94',
      '#3F8A36',
      '#A8890F',
      '#9A6595',
      '#C9636F',
      '#8A6650',
      '#7D7472',
    ],
  },
  {
    id: 'earth',
    name: '흙빛',
    colors: [
      '#8C510A',
      '#01665E',
      '#5E3C99',
      '#B35806',
      '#35978F',
      '#7F3B08',
      '#542788',
      '#4D4D4D',
    ],
  },
  {
    id: 'cool',
    name: '푸른 계열',
    colors: [
      '#08519C',
      '#00796B',
      '#5E35B1',
      '#1E88E5',
      '#2E7D32',
      '#3949AB',
      '#00838F',
      '#546E7A',
    ],
  },
];

export const DEFAULT_PALETTE = PALETTES[0]!.colors;

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}

/** 흐름 색이 'neutral'일 때 쓰는 회색 */
export const NEUTRAL_LINK_COLOR = '#8C959F';

/** 키 목록 순서대로 색을 배정한다. 같은 키는 항상 같은 색. */
export function assignColors(
  keys: readonly string[],
  palette: readonly string[] = DEFAULT_PALETTE,
) {
  const map = new Map<string, string>();
  for (const key of keys) {
    if (!map.has(key)) map.set(key, palette[map.size % palette.length]!);
  }
  return map;
}

/**
 * 노드 색 결정.
 * 순서는 **표에 입력된 순서**(오류 행 포함)를 따른다. 그래서 어떤 행이 잠시 오류가 나서
 * 그래프에서 빠져도 다른 노드의 색이 밀리지 않는다.
 * - colorMode 'node': 노드 이름마다 색
 * - colorMode 'group': 노드의 색상 그룹마다 색, 그룹이 없으면 노드 이름으로
 * 직접 지정한 색(nodeColorOverrides)이 항상 우선한다.
 */
export function nodeColors(
  rows: readonly Row[],
  nodes: readonly { id: string; group?: string }[],
  settings: Pick<Settings, 'paletteId' | 'colorMode' | 'nodeColorOverrides'>,
): Map<string, string> {
  const palette = getPalette(settings.paletteId).colors;
  const groupOf = new Map(nodes.map((n) => [n.id, n.group]));
  const keyOf = (id: string) =>
    settings.colorMode === 'group' ? (groupOf.get(id) ?? `node:${id}`) : `node:${id}`;

  const order: string[] = [];
  for (const row of rows) {
    if (settings.colorMode === 'group' && row.group?.trim()) order.push(row.group.trim());
    for (const name of [row.source, row.target]) {
      const id = normalizeName(name);
      if (id) order.push(keyOf(id));
    }
  }
  // 행에 없는 노드(이론상 없음)도 색을 받도록 마지막에 추가
  for (const n of nodes) order.push(keyOf(n.id));

  const byKey = assignColors(order, palette);
  return new Map(
    nodes.map((n) => [n.id, settings.nodeColorOverrides[n.id] ?? byKey.get(keyOf(n.id))!]),
  );
}

/** WCAG 상대 휘도 */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid color: ${hex}`);
  const n = parseInt(m[1]!, 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 대비율(1~21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const TEXT_DARK = '#1B1F24';
export const TEXT_LIGHT = '#FFFFFF';

/** 배경 위 글자색: 대비가 더 큰 쪽(어두운 글자 / 흰 글자)을 고른다. */
export function readableTextColor(background: string): string {
  return contrastRatio(background, TEXT_DARK) >= contrastRatio(background, TEXT_LIGHT)
    ? TEXT_DARK
    : TEXT_LIGHT;
}
