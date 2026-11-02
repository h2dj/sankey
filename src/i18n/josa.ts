/**
 * 받침에 맞는 조사 붙이기. "출발 노드을(를)" 대신 "출발 노드를", "홍보으로" 대신 "홍보로".
 * 마지막 글자가 한글·숫자·영문이 아니면(기호 등) 병기 형태("을(를)")로 둔다.
 */
type Pair = '을/를' | '은/는' | '이/가' | '과/와' | '으로/로';

const DIGIT_JONG: Record<string, number> = {
  // 0 영, 1 일, 2 이, 3 삼, 4 사, 5 오, 6 육, 7 칠, 8 팔, 9 구
  '0': 21,
  '1': 8,
  '2': 0,
  '3': 16,
  '4': 0,
  '5': 0,
  '6': 1,
  '7': 8,
  '8': 8,
  '9': 0,
};
const RIEUL = 8;

/** 마지막 글자의 받침 번호(0: 없음, 8: ㄹ), 알 수 없으면 null */
function jongseong(word: string): number | null {
  const ch = [...word.trim()].at(-1);
  if (!ch) return null;
  const code = ch.codePointAt(0)!;
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (ch in DIGIT_JONG) return DIGIT_JONG[ch]!;
  if (/[a-z]/i.test(ch)) {
    // 영어 단어는 끝소리로 어림한다: l → ㄹ, m·n·ng(g) → 받침 있음, 나머지는 없음
    const lower = ch.toLowerCase();
    if (lower === 'l') return RIEUL;
    return 'mng'.includes(lower) ? 21 : 0;
  }
  return null;
}

export function josa(word: string, pair: Pair): string {
  const [withJong, withoutJong] = pair.split('/') as [string, string];
  const j = jongseong(word);
  if (j === null) return `${word}${withJong}(${withoutJong})`;
  if (pair === '으로/로') return word + (j === 0 || j === RIEUL ? '로' : '으로');
  return word + (j === 0 ? withoutJong : withJong);
}

/** 조사만(예: particle('홍보', '으로/로') → '로'). 따옴표로 감싼 이름 뒤에 붙일 때 쓴다. */
export function particle(word: string, pair: Pair): string {
  return josa(word, pair).slice(word.length);
}

/** "이름" + 조사 */
export function quoted(word: string, pair: Pair): string {
  return `"${word}"${particle(word, pair)}`;
}
