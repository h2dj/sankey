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

/** 폭에 맞춰 단어 단위로 줄을 나눈다. 한 단어가 너무 길면 글자 단위로 자른다. */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      // 단어 하나가 폭을 넘으면 글자 단위로 자른다.
      for (const ch of word) {
        if (estimateTextWidth(line + ch, fontSize) > maxWidth && line) {
          lines.push(line);
          line = '';
        }
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
