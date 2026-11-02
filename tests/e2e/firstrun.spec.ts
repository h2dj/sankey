import { expect, test } from '@playwright/test';
import { cell, chart, issueSummary, links } from './helpers';

test('새로 만들기에서 제목·단위를 정하고 첫 칸에서 바로 입력한다', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  const dialog = page.getByRole('dialog', { name: '새 다이어그램' });
  await expect(dialog.getByLabel('제목(선택)')).toBeFocused();
  await page.keyboard.type('우리 동네 쓰레기 흐름');
  await dialog.getByLabel('값의 단위(선택)').fill('톤');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('우리 동네 쓰레기 흐름');
  await expect(cell(page, 1, '출발 노드')).toBeFocused();
  await expect(page.getByRole('columnheader', { name: /값 \(톤\)/ })).toBeVisible();

  await page.keyboard.type('가정');
  await page.keyboard.press('Tab');
  await page.keyboard.type('재활용');
  await page.keyboard.press('Tab');
  await page.keyboard.type('12');
  await expect(chart(page).locator('[data-label-for="가정"]')).toHaveText('가정 12 톤');
});

test('빈 미리보기에서 예시를 보거나 CSV를 가져올 수 있다', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  await page.getByRole('button', { name: '지우고 새로 시작' }).click();
  const preview = page.getByRole('region', { name: '미리보기' });
  await expect(preview.getByRole('button', { name: 'CSV 가져오기' })).toBeVisible();
  await preview.getByRole('button', { name: '예시 보기' }).click();
  await expect(links(page)).toHaveCount(10);
});

test('값에 단위를 붙여 쓰면 단위를 빼라고 안내한다', async ({ page }) => {
  await page.goto('./');
  await cell(page, 1, '값').fill('40백만원');
  await expect(issueSummary(page)).toContainText('"백만원"을 빼고 숫자만 입력하세요');
});
