import { describe, expect, it } from 'vitest';
import { FONT_SUBSETS } from './manifest';
import { parseUnicodeRange, subsetsForText } from './subsets';

describe('font subsets', () => {
  it('parseUnicodeRange', () => {
    expect(parseUnicodeRange('U+ac00-ac0f, U+20')).toEqual([
      [0xac00, 0xac0f],
      [0x20, 0x20],
    ]);
    expect(() => parseUnicodeRange('nope')).toThrow();
  });

  it('manifest의 모든 범위를 읽을 수 있다', () => {
    expect(FONT_SUBSETS.length).toBeGreaterThan(50);
    for (const s of FONT_SUBSETS)
      expect(parseUnicodeRange(s.unicodeRange).length).toBeGreaterThan(0);
  });

  it('필요한 분할만 고른다', () => {
    const latin = subsetsForText('abc 123');
    expect(latin.length).toBeGreaterThanOrEqual(1);
    const korean = subsetsForText('전체 예산 100 백만 원');
    expect(korean.length).toBeGreaterThan(latin.length);
    expect(korean.length).toBeLessThan(15);
    // 같은 글자를 반복해도 결과는 같다
    expect(subsetsForText('전체 예산 전체 예산 100 백만 원')).toEqual(korean);
    expect(subsetsForText('')).toEqual([]);
  });

  it('모든 한글 음절은 어떤 분할에든 들어 있다', () => {
    const sample = ['가', '힣', '똠', '쀍', '뷁'];
    for (const ch of sample) expect(subsetsForText(ch), ch).toHaveLength(1);
  });
});
