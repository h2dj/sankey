/**
 * Pretendard(OFL-1.1) 분할(dynamic subset) woff2 파일을 public/fonts/로 복사하고,
 * 분할별 유니코드 범위 목록(src/fonts/manifest.ts)을 만든다.
 *
 * - public/fonts/는 빌드 산출물이라 저장소에 넣지 않는다(.gitignore). dev·build 전에 자동 실행.
 * - manifest.ts는 저장소에 넣는다(타입 검사·단위 테스트가 글꼴 파일 없이 동작하도록).
 *
 * 사용: node scripts/fonts.mjs [--manifest]  (--manifest: manifest.ts도 다시 쓴다)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules/pretendard/dist/web/static');
const outDir = join(root, 'public/fonts');
const WEIGHTS = { 400: 'Pretendard-Regular', 600: 'Pretendard-SemiBold' };

const css = readFileSync(join(pkg, 'pretendard-dynamic-subset.css'), 'utf8');
// Regular 블록에서 분할 번호와 unicode-range를 읽는다(굵기마다 범위는 같다).
const blocks = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
const subsets = [];
for (const block of blocks) {
  const src = /Pretendard-Regular\.subset\.(\d+)\.woff2/.exec(block);
  const range = /unicode-range:\s*([^;]+);/.exec(block);
  if (src && range) subsets.push({ index: Number(src[1]), unicodeRange: range[1].trim() });
}
subsets.sort((a, b) => a.index - b.index);
if (subsets.length < 50) throw new Error(`Pretendard subsets not found (${subsets.length})`);

mkdirSync(outDir, { recursive: true });
let copied = 0;
for (const name of Object.values(WEIGHTS)) {
  for (const { index } of subsets) {
    const file = `${name}.subset.${index}.woff2`;
    const to = join(outDir, file);
    if (!existsSync(to)) {
      copyFileSync(join(pkg, 'woff2-dynamic-subset', file), to);
      copied += 1;
    }
  }
}
copyFileSync(
  join(root, 'node_modules/pretendard/dist/LICENSE.txt'),
  join(outDir, 'LICENSE-Pretendard.txt'),
);

if (process.argv.includes('--manifest')) {
  const lines = [
    '// 자동 생성: node scripts/fonts.mjs --manifest (손으로 고치지 않는다)',
    '// Pretendard 1.3.9 (SIL Open Font License 1.1) 분할 글꼴의 유니코드 범위',
    '',
    "export const FONT_FAMILY = 'Pretendard';",
    `export const FONT_WEIGHTS = ${JSON.stringify(WEIGHTS)} as const;`,
    '',
    'export const FONT_SUBSETS: readonly { index: number; unicodeRange: string }[] = [',
    ...subsets.map(
      (s) => `  { index: ${s.index}, unicodeRange: ${JSON.stringify(s.unicodeRange)} },`,
    ),
    '];',
    '',
  ];
  writeFileSync(join(root, 'src/fonts/manifest.ts'), lines.join('\n'));
}

console.log(
  `fonts: ${subsets.length} subsets × ${Object.keys(WEIGHTS).length} weights, copied ${copied}`,
);
