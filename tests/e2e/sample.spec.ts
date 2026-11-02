import { expect, test } from '@playwright/test';
import { chart, links, nodes, loadSampleUI } from './helpers';

test('A1: 예시 데이터가 안내 없이 다이어그램으로 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
  await expect(nodes(page)).toHaveCount(11);
  await expect(chart(page).locator('[data-label-for="전체 예산"]')).toHaveText(
    '전체 예산 100 백만 원',
  );
  await expect(chart(page).locator('title').first()).toHaveText('2026년 사업 예산 배분');
  await expect(page.getByText('입력 문제 없음')).toBeVisible();
});

test('다른 예시를 불러오고 실행 취소로 되돌린다', async ({ page }) => {
  await page.goto('/');
  await loadSampleUI(page, '에너지 흐름');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('지역 에너지 흐름');
  await expect(links(page)).toHaveCount(8);
  await expect(chart(page).locator('[data-label-for="발전"]')).toHaveText('발전 240 GWh');

  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 사업 예산 배분');
  await expect(links(page)).toHaveCount(10);
});
