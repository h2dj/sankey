/**
 * 노드 이름 비교용 정규화: 앞뒤 공백 제거 + 유니코드 NFC.
 * macOS(NFD)와 Windows(NFC)에서 입력한 한글이 같은 노드로 묶이도록 한다.
 * 대소문자는 구분한다.
 */
export function normalizeName(raw: string): string {
  return raw.trim().normalize('NFC');
}

const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const GROUPED_NUMBER = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;

export type ParsedValue =
  | { ok: true; value: number }
  | { ok: false; code: 'REQUIRED' | 'NOT_NUMBER' | 'NOT_POSITIVE' | 'NOT_FINITE' };

/**
 * 값 셀 파싱. 허용: `40`, `1.5`, `1,234.5`(천 단위 쉼표), `1e3`.
 * 거부: 빈 값, 문자, 16진수, 잘못된 쉼표 위치, 0 이하, 무한대.
 */
export function parseValue(raw: string): ParsedValue {
  const s = raw.trim();
  if (s === '') return { ok: false, code: 'REQUIRED' };

  let numeric: string;
  if (PLAIN_NUMBER.test(s)) numeric = s;
  else if (GROUPED_NUMBER.test(s)) numeric = s.replaceAll(',', '');
  else if (/^[+-]?(infinity|∞)$/i.test(s)) return { ok: false, code: 'NOT_FINITE' };
  else return { ok: false, code: 'NOT_NUMBER' };

  const value = Number(numeric);
  if (!Number.isFinite(value)) return { ok: false, code: 'NOT_FINITE' };
  if (value <= 0) return { ok: false, code: 'NOT_POSITIVE' };
  return { ok: true, value };
}
