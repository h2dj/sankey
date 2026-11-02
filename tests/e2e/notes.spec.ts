import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chart, links, loadSampleUI } from './helpers';

const settings = (page: Page) => page.getByRole('region', { name: '설정' });
// 각주 모드에서는 이름 뒤에 번호("교육 [1]")가 붙는다.
const noteBox = (page: Page, label: string) =>
  page.getByRole('textbox', { name: new RegExp(`^${label}( \\[\\d+\\])?$`) });
const rect = (page: Page, id: string) => chart(page).locator(`[data-node-id="${id}"]`);
const tooltip = (page: Page) => page.getByTestId('chart-tooltip');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(links(page)).toHaveCount(10);
});

test('노드에 메모를 쓰면 툴팁과 스크린리더 이름에 보인다', async ({ page }) => {
  await noteBox(page, '교육').fill('강사비 포함');
  await expect(rect(page, '교육')).toHaveAttribute('aria-label', /메모: 강사비 포함/);
  await rect(page, '교육').hover();
  await expect(tooltip(page)).toContainText('메모: 강사비 포함');
  await expect(settings(page)).toContainText('1개 작성');
});

test('각주 모드: 레이블에 번호, 차트 아래에 메모 목록', async ({ page }) => {
  await noteBox(page, '홍보').fill('온라인 위주');
  await noteBox(page, '교육').fill('강사비 포함');
  await settings(page)
    .getByLabel(/차트 아래에 각주/)
    .check();
  await expect(chart(page).locator('[data-label-for="교육"]')).toContainText('[1]');
  await expect(chart(page).locator('[data-label-for="홍보"]')).toContainText('[2]');
  const list = page.getByRole('list', { name: '노드 메모' });
  await expect(list.getByRole('listitem')).toHaveText([
    '[1] 교육 — 강사비 포함',
    '[2] 홍보 — 온라인 위주',
  ]);
});

test('레이블 아래 모드: 메모가 노드 레이블 아래에 보인다', async ({ page }) => {
  await noteBox(page, '교육').fill('강사비 포함');
  await settings(page)
    .getByLabel(/레이블 아래에 작게/)
    .check();
  await expect(chart(page).locator('[data-note-line="교육"]')).toHaveText('강사비 포함');
});

test('노드를 두 번 누르면(키보드: M) 그 노드의 메모 칸으로 간다', async ({ page }) => {
  // 섹션을 접어 두어도 펼쳐서 옮긴다
  await settings(page).getByText('노드 메모', { exact: true }).click();
  await rect(page, '운영').dblclick();
  await expect(noteBox(page, '운영')).toBeFocused();
  await page.keyboard.type('임대 계약 갱신');

  // 키보드: 차트 노드에 초점을 두고 M
  await rect(page, '홍보').focus();
  await page.keyboard.press('m');
  await expect(noteBox(page, '홍보')).toBeFocused();

  await rect(page, '운영').hover();
  await expect(tooltip(page)).toContainText('메모: 임대 계약 갱신');
});

test('메모 입력은 실행 취소로 되돌린다', async ({ page }) => {
  await noteBox(page, '교육').fill('강사비 포함');
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(noteBox(page, '교육')).toHaveValue('');
});

test('각주 모드 SVG에 메모가 들어가고, CSV로 내보낸 메모를 다시 불러온다', async ({ page }) => {
  await noteBox(page, '교육').fill('강사비 포함');
  await settings(page)
    .getByLabel(/차트 아래에 각주/)
    .check();

  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '내려받기' });
  await dialog.getByLabel(/SVG 벡터/).check();
  await dialog.getByLabel('파일 이름').fill('notes');
  const [svgDl] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'SVG 내려받기' }).click(),
  ]);
  const svg = readFileSync((await svgDl.path())!, 'utf8');
  expect(svg).toContain('>[1] 교육 — 강사비 포함</text>');

  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await dialog.getByLabel(/CSV 데이터/).check();
  const [csvDl] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'CSV 내려받기' }).click(),
  ]);
  const csvPath = (await csvDl.path())!;
  expect(readFileSync(csvPath, 'utf8')).toContain('출발 노드 메모,도착 노드 메모');

  await noteBox(page, '교육').fill('');
  await page.getByRole('button', { name: 'CSV 가져오기' }).click();
  await page.getByLabel('CSV 파일 선택').setInputFiles({
    name: 'notes.csv',
    mimeType: 'text/csv',
    buffer: readFileSync(csvPath),
  });
  const imp = page.getByRole('dialog', { name: 'CSV 가져오기' });
  await expect(imp.getByTestId('import-summary')).toContainText('노드 메모 1개를 읽었습니다');
  await imp.getByRole('button', { name: '가져오기' }).click();
  await expect(noteBox(page, '교육')).toHaveValue('강사비 포함');
});

test('시기별 예시에는 메모 예시가 들어 있다', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  await rect(page, '희망제작소').hover();
  await expect(tooltip(page)).toContainText('메모: 시민 제안 플랫폼에서 출발');
});

test('좁은 화면: 노드를 두 번 누르면 설정 탭의 메모 칸으로 간다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: '미리보기' }).click();
  await rect(page, '교육').dblclick();
  await expect(page.getByRole('tab', { name: '설정' })).toHaveAttribute('aria-selected', 'true');
  await expect(noteBox(page, '교육')).toBeFocused();
});

test('메모 기능에서 심각한 접근성 위반이 없다', async ({ page }) => {
  await noteBox(page, '교육').fill('강사비 포함');
  await settings(page)
    .getByLabel(/차트 아래에 각주/)
    .check();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});
