import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { cell, links } from './helpers';

const dialog = (page: Page) => page.getByRole('dialog', { name: '내려받기' });

async function exportAs(
  page: Page,
  setup: () => Promise<void> = async () => {},
): Promise<Download> {
  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await setup();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog(page)
      .getByRole('button', { name: /내려받기$/ })
      .click(),
  ]);
  await expect(dialog(page)).toBeHidden();
  return download;
}

/** PNG 머리(IHDR)에서 크기를 읽는다. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
});

test('A5: PNG — 2배 해상도, 파일명은 제목', async ({ page }) => {
  const download = await exportAs(page, async () => {
    await expect(dialog(page).getByTestId('export-filename')).toHaveText(
      '저장될 이름: 2026년 사업 예산 배분.png',
    );
    await dialog(page).getByLabel('차트 폭').selectOption('960');
    // 헤드리스 Chromium은 한글 파일명을 "download"로 바꾸므로 실제 다운로드 이름은 영문으로 확인한다.
    await dialog(page).getByLabel('파일 이름').fill('budget: 2026?');
    await expect(dialog(page).getByTestId('export-filename')).toHaveText(
      '저장될 이름: budget 2026.png',
    );
  });
  expect(download.suggestedFilename()).toBe('budget 2026.png');
  const size = pngSize(readFileSync((await download.path())!));
  expect(size.width).toBe((960 + 48) * 2);
  expect(size.height).toBeGreaterThan(400 * 2);
  await expect(page.getByRole('status').filter({ hasText: '파일을 내려받았습니다' })).toContainText(
    `(${size.width}×${size.height}px)`,
  );
});

test('A5: SVG — 제목·레이블·설정한 색이 들어 있고 화면용 속성은 없다', async ({ page }) => {
  await page.getByRole('region', { name: '설정' }).getByLabel('교육 색').fill('#123456');
  await page.getByRole('region', { name: '설정' }).getByLabel('제목').fill('Export Test');
  const download = await exportAs(page, async () => {
    await dialog(page)
      .getByLabel(/SVG 벡터/)
      .check();
  });
  expect(download.suggestedFilename()).toBe('Export Test.svg');
  const svg = readFileSync((await download.path())!, 'utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  expect(svg).toContain('>Export Test</text>');
  expect(svg).toContain('전체 예산<tspan');
  expect(svg).toContain('fill="#123456"');
  expect(svg).not.toMatch(/tabindex|role="button"|data-link-id/);
  expect(svg).not.toContain('@font-face'); // 기본은 글꼴 미포함
});

test('SVG 글꼴 포함 옵션', async ({ page }) => {
  const download = await exportAs(page, async () => {
    await dialog(page)
      .getByLabel(/SVG 벡터/)
      .check();
    await dialog(page)
      .getByLabel(/글꼴 포함/)
      .check();
  });
  const svg = readFileSync((await download.path())!, 'utf8');
  expect(svg).toContain(
    '@font-face{font-family:Pretendard;font-weight:400;src:url(data:font/woff2;base64,',
  );
  expect(svg).toContain('font-weight:600');
});

test('A6: CSV를 내려받아 다시 불러오면 같은 데이터', async ({ page }) => {
  await cell(page, 5, '메모').fill('쉼표, "따옴표" 포함');
  const download = await exportAs(page, async () => {
    await dialog(page)
      .getByLabel(/CSV 데이터/)
      .check();
    await dialog(page).getByLabel('파일 이름').fill('예산 데이터');
  });
  const path = (await download.path())!;
  const text = readFileSync(path, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('출발 노드,도착 노드,값 (백만 원),색상 그룹,메모\r\n');

  // 표를 지우고 다시 불러온다
  await page.getByLabel('예시 불러오기').selectOption({ label: '에너지 흐름' });
  await expect(links(page)).toHaveCount(8);
  await page.getByRole('button', { name: 'CSV 가져오기' }).click();
  await page.getByLabel('CSV 파일 선택').setInputFiles({
    name: 'roundtrip.csv',
    mimeType: 'text/csv',
    buffer: readFileSync(path),
  });
  await page.getByRole('dialog').getByRole('button', { name: '가져오기' }).click();
  await expect(links(page)).toHaveCount(10);
  await expect(cell(page, 5, '메모')).toHaveValue('쉼표, "따옴표" 포함');
  // "새 데이터로 바꾸기"는 CSV 값 열 이름의 단위도 가져온다.
  await expect(page.getByRole('region', { name: '설정' }).getByLabel('값의 단위')).toHaveValue(
    '백만 원',
  );
});

test('그릴 수 없으면 CSV만 내려받을 수 있다', async ({ page }) => {
  await cell(page, 5, '도착 노드').fill('전체 예산');
  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await expect(dialog(page)).toContainText('CSV만 내려받을 수 있습니다');
  await expect(dialog(page).getByRole('button', { name: 'CSV 내려받기' })).toBeVisible();
});

test('PNG 투명 배경', async ({ page }) => {
  const download = await exportAs(page, async () => {
    await dialog(page).getByLabel('투명').check();
    await dialog(page).getByLabel('1배(기본)').check();
  });
  const buf = readFileSync((await download.path())!);
  // 색 형식 6 = RGBA(투명도 있음)
  expect(buf[25]).toBe(6);
});
