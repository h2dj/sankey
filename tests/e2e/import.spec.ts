import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { cell, chart, issueSummary, links } from './helpers';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/csv/${name}`, import.meta.url));
const dialog = (page: Page) => page.getByRole('dialog', { name: 'CSV 가져오기' });

async function openAndPick(page: Page, file: string) {
  await page.getByRole('button', { name: 'CSV 가져오기' }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('CSV 파일 선택').setInputFiles(fixture(file));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
});

test('UTF-8 CSV를 가져와 표와 차트를 바꾼다', async ({ page }) => {
  await openAndPick(page, 'utf8.csv');
  await expect(dialog(page)).toContainText('UTF-8 · 쉼표 구분 · 4줄');
  await expect(dialog(page).getByTestId('import-summary')).toHaveText('4행을 읽었습니다.');
  await expect(dialog(page).getByRole('table')).toContainText('외부 강사 포함');
  await dialog(page).getByRole('button', { name: '가져오기' }).click();

  await expect(dialog(page)).toBeHidden();
  await expect(
    page.getByRole('status').filter({ hasText: 'utf8.csv에서 4행을 가져왔습니다' }),
  ).toBeVisible();
  await expect(links(page)).toHaveCount(4);
  await expect(cell(page, 4, '도착 노드')).toHaveValue('교재비');
  await expect(cell(page, 3, '메모')).toHaveValue('외부 강사 포함');
  // 초점은 가져오기 버튼으로 돌아온다
  await expect(page.getByRole('button', { name: 'CSV 가져오기' })).toBeFocused();
});

test('엑셀 기본 CSV(EUC-KR)를 읽고 값 열의 단위를 가져온다', async ({ page }) => {
  await openAndPick(page, 'cp949.csv');
  await expect(dialog(page)).toContainText('EUC-KR');
  await expect(dialog(page)).toContainText('단위 "백만 원"');
  await expect(dialog(page).getByLabel('출발 노드', { exact: true })).toHaveValue('0');
  await expect(dialog(page).getByLabel('색상 그룹')).toHaveValue('3');
  await dialog(page).getByRole('button', { name: '가져오기' }).click();
  await expect(cell(page, 1, '출발 노드')).toHaveValue('전체 예산');
  await expect(chart(page).locator('[data-label-for="전체 예산"]')).toHaveText(
    '전체 예산 70 백만 원',
  );
});

test('잘못된 파일이면 원인을 보이고 기존 데이터를 유지한다', async ({ page }) => {
  await openAndPick(page, 'unclosed-quote.csv');
  await expect(dialog(page).getByRole('alert')).toContainText('큰따옴표(")가 닫히지 않았습니다');
  await expect(dialog(page).getByRole('alert')).toContainText('지금 표의 데이터는 그대로 있습니다');

  await dialog(page).getByLabel('CSV 파일 선택').setInputFiles(fixture('image.png'));
  await expect(dialog(page).getByRole('alert')).toContainText('텍스트 CSV 파일이 아닌');

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(links(page)).toHaveCount(10);
});

test('머리글 없는 파일: 열을 직접 맞춘다', async ({ page }) => {
  await openAndPick(page, 'no-header.csv');
  await expect(dialog(page).getByLabel('첫 줄은 열 이름입니다')).not.toBeChecked();
  await expect(dialog(page).getByTestId('import-summary')).toHaveText('3행을 읽었습니다.');

  // 같은 열을 두 번 고르면 막는다
  await dialog(page).getByLabel('도착 노드', { exact: true }).selectOption('0');
  await expect(dialog(page).getByRole('alert')).toContainText('서로 다른 열');
  await expect(dialog(page).getByRole('button', { name: '가져오기' })).toBeDisabled();
  await dialog(page).getByLabel('도착 노드', { exact: true }).selectOption('1');
  await expect(dialog(page).getByRole('button', { name: '가져오기' })).toBeEnabled();
});

test('기존 데이터 뒤에 추가하고 실행 취소한다', async ({ page }) => {
  await openAndPick(page, 'tab.tsv');
  await dialog(page).getByLabel('유지하고 뒤에 추가하기').check();
  await dialog(page).getByRole('button', { name: '뒤에 추가' }).click();
  await expect(cell(page, 13, '출발 노드')).toHaveValue('Power');
  await expect(links(page)).toHaveCount(13);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(links(page)).toHaveCount(10);
});

test('가져온 뒤 고칠 오류 수를 미리 알려 준다', async ({ page }) => {
  await openAndPick(page, 'semicolon.csv');
  await expect(dialog(page).getByTestId('import-summary')).toContainText('입력 오류가 1건');
  await dialog(page).getByRole('button', { name: '가져오기' }).click();
  await expect(issueSummary(page)).toContainText('"1.234,5"는 숫자가 아닙니다');
});

test('데이터 영역에 파일을 끌어다 놓으면 가져오기 창이 열린다', async ({ page }) => {
  const bytes = [...readFileSync(fixture('utf8.csv'))];
  const dt = await page.evaluateHandle((data) => {
    const t = new DataTransfer();
    t.items.add(new File([new Uint8Array(data)], 'dropped.csv', { type: 'text/csv' }));
    return t;
  }, bytes);
  const panel = page.getByRole('region', { name: '데이터' });
  await panel.dispatchEvent('dragover', { dataTransfer: dt });
  await panel.dispatchEvent('drop', { dataTransfer: dt });
  await expect(dialog(page)).toContainText('dropped.csv');
  await expect(dialog(page).getByTestId('import-summary')).toHaveText('4행을 읽었습니다.');
});
