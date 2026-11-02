/**
 * 글자 폭 어림값(px). 실제 글꼴 측정 없이 레이아웃 여백을 잡는 데 쓴다.
 * 한글·한자·전각 문자는 글자 크기와 거의 같고, 라틴 문자·숫자는 약 0.6배.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (
      (code >= 0x1100 && code <= 0x11ff) || // 한글 자모
      (code >= 0x3000 && code <= 0x9fff) || // CJK 기호·한자·가나
      (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
      (code >= 0xff00 && code <= 0xffef) // 전각
    ) {
      em += 1;
    } else if (ch === ' ') {
      em += 0.3;
    } else {
      em += 0.6;
    }
  }
  return em * fontSize;
}
