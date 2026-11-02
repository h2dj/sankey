/** 파일 이름에 쓸 수 없는 문자 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * 사용자가 입력한 이름(보통 다이어그램 제목)을 안전한 파일 이름으로 만든다.
 * 한글은 그대로 두고, 금지 문자는 지우며, 비면 기본 이름을 쓴다. 확장자는 붙여서 돌려준다.
 */
export function safeFilename(name: string, ext: string, fallback = 'sankey-diagram'): string {
  let base = name.normalize('NFC').replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim();
  // 사용자가 확장자까지 적었으면 떼어 낸다.
  base = base
    .replace(new RegExp(`\\.${ext}$`, 'i'), '')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  if ([...base].length > 100) base = [...base].slice(0, 100).join('').trim();
  if (!base || RESERVED.test(base)) base = fallback;
  return `${base}.${ext}`;
}
