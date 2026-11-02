import { expect, test } from '@playwright/test';
import { cell, links } from './helpers';

const KEY = 'sankey-maker:autosave';

test('F-07: 편집 내용이 자동 저장되고 새로고침 후 복구된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('save-status')).toHaveText(
    '변경하면 이 브라우저에 자동 저장됩니다',
  );
  await cell(page, 1, '값').fill('55');
  await page.getByRole('region', { name: '설정' }).getByLabel('제목').fill('저장 시험');
  await expect(page.getByTestId('save-status')).toContainText('이 브라우저에 자동 저장됨');

  await page.reload();
  await expect(cell(page, 1, '값')).toHaveValue('55');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('저장 시험');
  await expect(page.getByTestId('save-status')).toContainText('지난 작업을 불러왔습니다');
});

test('A8: 저장 위치와 한계를 안내한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('서버로 전송하지 않습니다')).toBeVisible();
  await page.getByText('저장 안내').click();
  await expect(page.getByText('다른 기기나 다른 브라우저에서는 보이지 않고')).toBeVisible();
  await expect(page.getByText('[내려받기 → CSV]')).toBeVisible();
});

test('탭을 숨기면 기다리지 않고 바로 저장한다', async ({ page }) => {
  await page.goto('/');
  await cell(page, 2, '값').fill('31');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const saved = await page.evaluate((k) => localStorage.getItem(k), KEY);
  expect(saved).toContain('"value":"31"');
});

test('저장된 내용이 손상되었으면 알리고 예시로 시작한다', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{broken'), KEY);
  await page.goto('/');
  await expect(
    page.getByRole('status').filter({ hasText: '저장된 작업을 읽지 못해' }),
  ).toBeVisible();
  await expect(links(page)).toHaveCount(10);
});

test('저장소를 쓸 수 없으면 CSV 보관을 안내한다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('save-status')).toContainText('자동 저장을 쓸 수 없습니다');
  await expect(links(page)).toHaveCount(10);
});

test('새로 만들기: 확인 후 빈 다이어그램, 실행 취소로 되돌리기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  const dialog = page.getByRole('dialog', { name: '새 다이어그램' });
  await expect(dialog).toContainText('자동 저장된 내용도 새 작업으로 바뀝니다');
  await dialog.getByRole('button', { name: '지우고 새로 시작' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('제목 없는 다이어그램');
  await expect(
    page.getByText('출발 노드, 도착 노드, 값을 입력하면 다이어그램이 나타납니다.'),
  ).toBeVisible();
  await expect(cell(page, 1, '출발 노드')).toHaveValue('');

  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(links(page)).toHaveCount(10);
});

test('새로 만들기 전에 CSV로 보관하기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새로 만들기' }).click();
  await page.getByRole('button', { name: '먼저 CSV로 보관하기' }).click();
  await expect(page.getByRole('dialog', { name: '내려받기' })).toBeVisible();
});
