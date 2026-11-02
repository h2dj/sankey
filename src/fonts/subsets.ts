import { FONT_SUBSETS } from './manifest';

type Range = readonly [number, number];

/** "U+ac00-ac0f, U+20" → [[0xac00, 0xac0f], [0x20, 0x20]] */
export function parseUnicodeRange(spec: string): Range[] {
  return spec.split(',').map((part) => {
    const m = /^\s*U\+([0-9a-f]+)(?:-([0-9a-f]+))?\s*$/i.exec(part);
    if (!m) throw new Error(`Invalid unicode-range: ${part}`);
    const start = parseInt(m[1]!, 16);
    return [start, m[2] ? parseInt(m[2], 16) : start] as const;
  });
}

let parsed: { index: number; ranges: Range[] }[] | null = null;
function table() {
  parsed ??= FONT_SUBSETS.map((s) => ({
    index: s.index,
    ranges: parseUnicodeRange(s.unicodeRange),
  }));
  return parsed;
}

/** 글자들을 그리는 데 필요한 분할 글꼴 번호(오름차순). 어느 분할에도 없는 글자는 무시한다. */
export function subsetsForText(text: string): number[] {
  const codes = new Set<number>();
  for (const ch of text) codes.add(ch.codePointAt(0)!);
  const needed = new Set<number>();
  for (const { index, ranges } of table()) {
    for (const code of codes) {
      if (ranges.some(([a, b]) => code >= a && code <= b)) {
        needed.add(index);
        break;
      }
    }
  }
  return [...needed].sort((a, b) => a - b);
}
