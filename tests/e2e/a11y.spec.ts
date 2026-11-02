import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { cell, links } from './helpers';

async function expectNoSerious(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${where}: ${v.id} ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test('여러 상태에서 심각한 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/');
  await expectNoSerious(page, '첫 화면');

  await cell(page, 2, '값').fill('abc');
  await cell(page, 5, '도착 노드').fill('전체 예산');
  await expect(page.getByText('다이어그램을 그릴 수 없습니다.')).toBeVisible();
  await expectNoSerious(page, '오류 상태');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');

  await page.getByRole('button', { name: 'CSV 가져오기' }).click();
  await expectNoSerious(page, '가져오기 창');
  await page.getByLabel('CSV 파일 선택').setInputFiles({
    name: 'a.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('출발,도착,값\nA,B,1\n'),
  });
  await expect(page.getByTestId('import-summary')).toBeVisible();
  await expectNoSerious(page, '열 맞추기');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await expectNoSerious(page, '내려받기 창');
});

test('스크린리더용 흐름 표가 있다', async ({ page }) => {
  await page.goto('/');
  const table = page.getByRole('table', { name: /흐름 목록/ });
  await expect(table.getByRole('row')).toHaveCount(11);
  await expect(table.getByRole('row').nth(5)).toContainText('교육강사비25 백만 원63%');
});

test('본문 바로가기 링크', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '작업 영역으로 건너뛰기' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(cell(page, 1, '출발 노드')).toBeFocused();
});

test('A7: 키보드만으로 예시 불러오기 → 값 수정 → PNG 내려받기', async ({ page }) => {
  await page.goto('/');
  // 예시 선택 상자까지 Tab으로 이동해 방향키로 고르고, 다음 버튼으로 불러온다
  const select = page.getByLabel('예시 데이터');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    if (await select.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(select).toBeFocused();
  await page.keyboard.press('ArrowDown'); // 사업 예산 → 에너지 흐름
  await expect(select).toHaveValue('energy');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '예시 불러오기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('지역 에너지 흐름');

  // 다음 Tab은 본문(표)으로
  await page.keyboard.press('Tab');
  await expect(cell(page, 1, '출발 노드')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(cell(page, 1, '값')).toBeFocused();
  await page.keyboard.type('150');
  await expect(links(page)).toHaveCount(8);

  // 내려받기 버튼까지 Shift+Tab
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Shift+Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    if (focused === '내려받기') break;
  }
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '내려받기' });
  await expect(dialog).toBeVisible();
  // 파일 이름 칸으로 가서 영문 이름 입력(헤드리스의 한글 파일명 문제 회피)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    if (await dialog.getByLabel('파일 이름').evaluate((el) => el === document.activeElement)) break;
  }
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('energy');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    if (focused === 'PNG 내려받기') break;
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Enter'),
  ]);
  expect(download.suggestedFilename()).toBe('energy.png');
  expect(
    readFileSync((await download.path())!)
      .subarray(1, 4)
      .toString(),
  ).toBe('PNG');
  // 창이 닫히면 초점은 내려받기 버튼으로 돌아온다
  await expect(page.getByRole('button', { name: '내려받기', exact: true })).toBeFocused();
});

test('CSP 위반·콘솔 오류 없이 PNG를 만든다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await page.getByLabel('파일 이름').fill('csp');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG 내려받기' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('csp.png');
  expect(errors).toEqual([]);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
});
