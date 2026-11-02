import { fontUrl } from '../fonts/register';
import { FONT_FAMILY, FONT_SUBSETS, FONT_WEIGHTS } from '../fonts/manifest';
import { subsetsForText } from '../fonts/subsets';

type Weight = keyof typeof FONT_WEIGHTS;

const cache = new Map<string, Promise<string>>();

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`글꼴 파일을 읽지 못했습니다: ${url} (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function subsetData(weight: Weight, index: number): Promise<string> {
  const url = fontUrl(weight, index);
  let p = cache.get(url);
  if (!p) {
    p = toBase64(url);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/**
 * 문서에 쓰인 글자가 든 분할 글꼴만 data URI로 넣은 @font-face 규칙.
 * SVG를 <img>로 그리는 PNG 변환에서는 외부 글꼴을 불러올 수 없으므로 이 방법이 필요하다.
 */
export async function embeddedFontCss(text: { regular: string; bold: string }): Promise<string> {
  const jobs: Promise<string>[] = [];
  const add = (weight: Weight, chars: string) => {
    for (const index of subsetsForText(chars)) {
      const range = FONT_SUBSETS.find((s) => s.index === index)!.unicodeRange;
      jobs.push(
        subsetData(weight, index).then(
          (b64) =>
            `@font-face{font-family:${FONT_FAMILY};font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`,
        ),
      );
    }
  };
  add('400', text.regular);
  if (text.bold) add('600', text.bold);
  return (await Promise.all(jobs)).join('\n');
}
