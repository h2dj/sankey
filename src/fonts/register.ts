import { FONT_FAMILY, FONT_SUBSETS, FONT_WEIGHTS } from './manifest';

/** 분할 글꼴 파일 URL. 정적 호스팅 하위 경로에서도 동작하도록 BASE_URL 기준. */
export function fontUrl(weight: keyof typeof FONT_WEIGHTS, index: number): string {
  return `${import.meta.env.BASE_URL}fonts/${FONT_WEIGHTS[weight]}.subset.${index}.woff2`;
}

/**
 * Pretendard를 등록한다. 등록만 하고 내려받지는 않는다. 브라우저는 화면에 실제로 쓰인
 * 글자가 든 분할 파일만 내려받는다(@font-face unicode-range와 같은 동작).
 */
export function registerFonts(): void {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  for (const weight of Object.keys(FONT_WEIGHTS) as (keyof typeof FONT_WEIGHTS)[]) {
    for (const { index, unicodeRange } of FONT_SUBSETS) {
      const face = new FontFace(FONT_FAMILY, `url(${fontUrl(weight, index)}) format('woff2')`, {
        weight,
        unicodeRange,
        display: 'swap',
      });
      document.fonts.add(face);
    }
  }
}
