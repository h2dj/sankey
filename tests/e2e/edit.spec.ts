import { expect, test } from '@playwright/test';
import { cell, chart, issueSummary, links, pasteText } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
});

test('A2: 값을 고치면 미리보기와 노드 값이 갱신된다', async ({ page }) => {
  await cell(page, 1, '값').fill('50');
  await expect(chart(page).locator('[data-label-for="전체 예산"]')).toHaveText(
    '전체 예산 110 백만 원',
  );
  await expect(chart(page).locator('[data-link-id] title').first()).toHaveText(
    '전체 예산 → 교육: 50 백만 원',
  );
  // 교육으로 50이 들어오고 40이 나가므로 불균형 경고
  await expect(issueSummary(page)).toContainText('경고 1건');
  await expect(issueSummary(page)).toContainText(
    '"교육"으로 들어오는 값(50)과 나가는 값(40)이 다릅니다',
  );
});

test('A2: 출발·도착 이름을 고치면 연결이 바뀐다', async ({ page }) => {
  await cell(page, 4, '도착 노드').fill('교육');
  // 예비비 노드가 사라지고 전체 예산 → 교육이 합산된다.
  await expect(chart(page).locator('[data-node-id="예비비"]')).toHaveCount(0);
  await expect(links(page)).toHaveCount(9);
  await expect(issueSummary(page)).toContainText('하나로 합산했습니다');
});

test('A3: 숫자 오류를 셀 단위로 보이고, 요약에서 셀로 이동한다', async ({ page }) => {
  const value = cell(page, 3, '값');
  await value.fill('스물');
  await expect(value).toHaveAttribute('aria-invalid', 'true');
  await expect(issueSummary(page)).toContainText('오류 1건');
  await expect(issueSummary(page)).toContainText('"스물"은(는) 숫자가 아닙니다');
  // 오류 행만 빠지고 나머지는 그린다.
  await expect(links(page)).toHaveCount(9);

  await cell(page, 1, '출발 노드').focus();
  await issueSummary(page).getByRole('button', { name: '3행 · 값' }).click();
  await expect(value).toBeFocused();

  // 오류 설명이 스크린리더용 텍스트로 연결된다.
  const descId = await value.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${descId}"]`)).toContainText('숫자가 아닙니다');
});

test('A3: 필수 셀 누락', async ({ page }) => {
  await cell(page, 2, '출발 노드').fill('');
  await expect(cell(page, 2, '출발 노드')).toHaveAttribute('aria-invalid', 'true');
  await expect(issueSummary(page)).toContainText('출발 노드을(를) 입력하세요');
});

test('순환 연결이면 그리지 않고 경로를 안내한다', async ({ page }) => {
  await cell(page, 5, '도착 노드').fill('전체 예산');
  await expect(page.getByText('다이어그램을 그릴 수 없습니다.')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('전체 예산 → 교육 → 전체 예산');
  await expect(chart(page)).toHaveCount(0);
});

test('엑셀에서 복사한 여러 행을 붙여넣는다', async ({ page }) => {
  await pasteText(
    page,
    10,
    '출발 노드',
    '홍보\t인쇄물\t8\r\n강사비\t외부 강사\t10\r\n강사비\t내부 강사\t15\r\n',
  );
  await expect(page.getByRole('status').filter({ hasText: '붙여넣었습니다' })).toHaveText(
    '3행을 붙여넣었습니다.',
  );
  await expect(cell(page, 12, '도착 노드')).toHaveValue('내부 강사');
  await expect(chart(page).locator('[data-node-id="외부 강사"]')).toHaveCount(1);
  await expect(issueSummary(page)).toContainText('입력 문제 없음');
});

test('행 삭제 버튼과 실행 취소', async ({ page }) => {
  await page.getByRole('button', { name: '10행 삭제' }).click();
  await expect(links(page)).toHaveCount(9);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(links(page)).toHaveCount(10);
  await expect(cell(page, 10, '도착 노드')).toHaveValue('인쇄물');
});
