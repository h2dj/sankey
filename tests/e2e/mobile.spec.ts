import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cell, chart } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('좁은 화면: 탭으로 데이터·미리보기·설정을 전환한다', async ({ page }) => {
  const tabs = page.getByRole('tablist', { name: '작업 화면' });
  await expect(tabs.getByRole('tab', { name: '데이터' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: '데이터' })).toBeVisible();
  await expect(chart(page)).toBeHidden();

  await tabs.getByRole('tab', { name: '미리보기' }).click();
  await expect(chart(page)).toBeVisible();
  await expect(cell(page, 1, '값')).toBeHidden();

  // 방향키로 탭 이동
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: '설정' })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: '설정' })).toBeVisible();
});

test('좁은 화면: 가로 스크롤 없이, 차트는 글자를 줄이지 않고 상자 안에서 스크롤', async ({
  page,
}) => {
  for (const name of ['데이터', '미리보기', '설정']) {
    await page.getByRole('tab', { name }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
  await page.getByRole('tab', { name: '미리보기' }).click();
  const svg = chart(page);
  expect(Number(await svg.getAttribute('width'))).toBeGreaterThanOrEqual(560);
  expect((await svg.boundingBox())!.width).toBeGreaterThanOrEqual(559);
});

test('좁은 화면: 차트의 흐름을 누르면 데이터 탭의 해당 행으로 간다', async ({ page }) => {
  await page.getByRole('tab', { name: '미리보기' }).click();
  await chart(page).locator('[data-source="교육"][data-target="강사비"]').click();
  await expect(page.getByRole('tab', { name: '데이터' })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 5, '값')).toBeFocused();
});

test('좁은 화면: 데이터 탭에 오류 수를 보인다', async ({ page }) => {
  await cell(page, 1, '값').fill('abc');
  await expect(page.getByRole('tab', { name: /데이터, 오류 1건/ })).toBeVisible();
});

test('좁은 화면: 심각한 접근성 위반이 없다', async ({ page }) => {
  for (const name of ['데이터', '미리보기', '설정']) {
    await page.getByRole('tab', { name }).click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${name}: ${v.id} ${v.help}`)).toEqual([]);
  }
});
