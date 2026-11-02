import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cell, chart, links } from './helpers';

const tooltip = (page: import('@playwright/test').Page) => page.getByTestId('chart-tooltip');
const link = (page: import('@playwright/test').Page, source: string, target: string) =>
  chart(page).locator(`[data-source="${source}"][data-target="${target}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
});

test('흐름에 마우스를 올리면 출발·도착·값·비율을 보인다', async ({ page }) => {
  await link(page, '교육', '강사비').hover();
  await expect(tooltip(page)).toContainText('교육 → 강사비');
  await expect(tooltip(page)).toContainText('25 백만 원');
  await expect(tooltip(page)).toContainText('교육에서 나가는 값의 63%');
  await expect(tooltip(page)).toContainText('5행');
  // 마우스를 올린 흐름 외에는 흐리게
  await expect(link(page, '교육', '교재비')).toHaveAttribute('stroke-opacity', '0.1');
  await page.mouse.move(0, 0);
  await expect(tooltip(page)).toBeHidden();
});

test('노드 툴팁: 들어옴·나감과 연결된 행', async ({ page }) => {
  await chart(page).locator('[data-node-id="교육"]').hover();
  await expect(tooltip(page)).toContainText('들어옴 40 · 나감 40');
  await expect(tooltip(page)).toContainText('1, 5, 6행');
});

test('흐름을 누르면 해당 행으로 이동하고 강조한다', async ({ page }) => {
  await link(page, '운영', '임대료').click();
  await expect(cell(page, 8, '값')).toBeFocused();
  await expect(page.locator('tr[data-row="8"]')).toHaveAttribute('data-selected', 'true');
  await expect(link(page, '운영', '임대료')).toHaveAttribute('stroke-opacity', '0.7');
  await expect(link(page, '운영', '인건비')).toHaveAttribute('stroke-opacity', '0.1');
});

test('표의 셀에 초점을 두면 해당 흐름을 강조한다', async ({ page }) => {
  await cell(page, 6, '출발 노드').focus();
  await expect(link(page, '교육', '교재비')).toHaveAttribute('stroke-opacity', '0.7');
  await expect(link(page, '교육', '강사비')).toHaveAttribute('stroke-opacity', '0.1');
  // 표 밖으로 나가면 강조 해제
  await page.getByRole('button', { name: '+ 행 추가' }).focus();
  await expect(link(page, '교육', '강사비')).toHaveAttribute('stroke-opacity', '0.45');
});

test('키보드로 차트 요소를 탐색하고 선택한다', async ({ page }) => {
  // 확대 컨트롤 다음 Tab 위치가 차트(첫 노드)
  await page.getByRole('button', { name: '전체 화면' }).focus();
  await page.keyboard.press('Tab');
  const first = chart(page).locator('[data-node-id="전체 예산"]');
  await expect(first).toBeFocused();
  await expect(tooltip(page)).toContainText('전체 예산');

  await page.keyboard.press('ArrowDown');
  await expect(chart(page).locator('[data-node-id="교육"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(link(page, '홍보', '인쇄물')).toBeFocused();
  await expect(tooltip(page)).toContainText('홍보 → 인쇄물');

  await page.keyboard.press('Enter');
  await expect(cell(page, 10, '값')).toBeFocused();

  // Esc로 선택을 풀고, 다시 Tab으로 들어오면 마지막으로 있던 요소로 돌아온다
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '선택 해제' })).toBeHidden();
  await page.getByRole('button', { name: '전체 화면' }).focus();
  await page.keyboard.press('Tab');
  await expect(link(page, '홍보', '인쇄물')).toBeFocused();
});

test('확대·축소와 맞춤', async ({ page }) => {
  const canvas = chart(page).locator('xpath=..');
  const w0 = (await canvas.boundingBox())!.width;
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await expect(page.getByRole('button', { name: /확대 비율 150%/ })).toBeVisible();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(w0 * 1.4);
  await page.getByRole('button', { name: /확대 비율/ }).click();
  await expect(page.getByRole('button', { name: /확대 비율 100%/ })).toBeVisible();
});

test('상호작용 상태에서도 심각한 접근성 위반이 없다', async ({ page }) => {
  await link(page, '교육', '강사비').click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});
