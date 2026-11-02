import { expect, test } from '@playwright/test';
import { cell, chart, links } from './helpers';

test('키보드만으로 새 행을 입력하고 되돌린다', async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);

  // 마지막 행에서 Enter → 새 행의 같은 열로 이동
  await cell(page, 10, '출발 노드').focus();
  await page.keyboard.press('Enter');
  await expect(cell(page, 11, '출발 노드')).toBeFocused();

  await page.keyboard.type('인쇄물');
  await page.keyboard.press('Tab');
  await page.keyboard.type('포스터');
  await page.keyboard.press('Tab');
  await page.keyboard.type('8');
  await expect(chart(page).locator('[data-node-id="포스터"]')).toHaveCount(1);
  await expect(links(page)).toHaveCount(11);

  // 위·아래 이동
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, 10, '값')).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(cell(page, 9, '값')).toBeFocused();

  // Ctrl+Enter: 현재 행 아래에 새 행
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(cell(page, 10, '출발 노드')).toBeFocused();
  await expect(cell(page, 10, '출발 노드')).toHaveValue('');

  // Ctrl+Delete: 현재 행 삭제
  await page.keyboard.press('ControlOrMeta+Delete');
  await expect(cell(page, 10, '출발 노드')).toHaveValue('홍보');

  // 실행 취소: 삭제 → 행 추가 → 값 입력 순으로 되돌린다
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cell(page, 11, '값')).toHaveValue('');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(cell(page, 11, '값')).toHaveValue('8');
});
