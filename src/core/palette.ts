/**
 * 기본 색상 팔레트. Okabe–Ito 색각 이상 고려 팔레트를 바탕으로
 * 흰 배경에서 노드 막대가 잘 보이도록(대비 3:1 이상) 일부 색을 어둡게 조정했다.
 * 팔레트 선택·직접 지정은 S2(T2.2)에서 확장한다.
 */
export const DEFAULT_PALETTE = [
  '#0072B2',
  '#C26A00',
  '#00876A',
  '#B3478C',
  '#3A86C8',
  '#C24E00',
  '#7A6F00',
  '#6B6B6B',
] as const;

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
