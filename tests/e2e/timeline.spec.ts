import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chart, issueSummary, links, loadSampleUI } from './helpers';

const settings = (page: Page) => page.getByRole('region', { name: '설정' });
const nodeX = async (page: Page, id: string) =>
  Number(await chart(page).locator(`[data-node-id="${id}"]`).getAttribute('x'));
const headerX = async (page: Page, label: string) =>
  Number(
    await chart(page)
      .locator('[data-period-label]', { hasText: new RegExp(`^${label}\\s*$`) })
      .getAttribute('x'),
  );
const headers = (page: Page) => chart(page).locator('[data-period-label]');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(links(page)).toHaveCount(10);
});

test('시기별 예시: 시기 머리글이 보이고, 단계가 같아도 시기가 다르면 다른 열에 놓인다', async ({
  page,
}) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  await expect(headers(page)).toHaveText(['2000', '2005', '2010', '2015', '2020']);
  await expect(issueSummary(page)).toContainText('시기를 정하지 않은 노드 1개는');

  // 희망제작소는 시기를 정하지 않았지만 2010 모임으로 이어지므로 2010 띠에 놓인다.
  const hope = await nodeX(page, '희망제작소');
  expect(hope).toBeGreaterThan(await headerX(page, '2005'));
  expect(hope).toBeLessThan(await headerX(page, '2015'));

  // 시기 배치를 끄면 연결 단계(깊이)대로 2000년 단체들과 같은 첫 열로 간다.
  await settings(page)
    .getByLabel(/시기별로 배치/)
    .uncheck();
  await expect(headers(page)).toHaveCount(0);
  await expect.poll(() => nodeX(page, '희망제작소')).toBe(await nodeX(page, '진보네트워크'));
});

test('노드의 시기를 바꾸면 열이 옮겨지고, 시간을 거스르면 경고한다', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  const before = await nodeX(page, '오픈소스운동');
  await settings(page).getByLabel('오픈소스운동 시기').selectOption({ label: '2015' });
  await expect.poll(() => nodeX(page, '오픈소스운동')).toBeGreaterThan(before + 50);

  await settings(page).getByLabel('공동체IT 시기').selectOption({ label: '2005' });
  await expect(issueSummary(page)).toContainText(
    '"비영리IT지원센터 → 공동체IT" 흐름이 시간을 거슬러 갑니다(2015 → 2005)',
  );

  // "자동"으로 돌리면 추정 시기를 보여 준다.
  await settings(page).getByLabel('공동체IT 시기').selectOption('');
  await expect(settings(page).getByLabel('공동체IT 시기')).toContainText('자동 (2015)');
});

test('시기 머리글을 누르면 그 시기의 노드·흐름·행을 강조한다(키보드로도)', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  const h2010 = chart(page).locator('[role="button"][data-period-id]').nth(2);
  await h2010.click();
  await expect(h2010).toHaveAttribute('aria-pressed', 'true');
  // 2010: 희망제작소·IT단체설립모임·오픈소스운동에 닿는 행(4~8행)
  await expect(page.locator('tr[data-selected="true"]')).toHaveCount(5);
  await expect(chart(page).locator('[data-source="진보네트워크"]')).toHaveAttribute(
    'stroke-opacity',
    '0.1',
  );

  await h2010.press('Enter'); // 다시 누르면 해제
  await expect(h2010).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('tr[data-selected="true"]')).toHaveCount(0);
});

test('시기를 만들고 이름·순서를 바꾼다', async ({ page }) => {
  const s = settings(page);
  await s.getByLabel(/시기별로 배치/).check();
  await s.getByRole('button', { name: '지금 단계로 시기 만들기' }).click();
  await expect(headers(page)).toHaveText(['1단계', '2단계', '3단계']);

  await s.getByLabel('1번째 시기 이름').fill('2024');
  await expect(headers(page).first()).toHaveText('2024');

  await s.getByRole('button', { name: '+ 시기 추가' }).click();
  await expect(headers(page)).toHaveCount(4);
  await expect(s.getByLabel('4번째 시기 이름')).toHaveValue('4단계');

  // 마지막(빈) 시기를 맨 앞으로 옮기면 노드가 없는 띠가 앞에 생긴다
  for (let i = 0; i < 3; i++) await s.getByRole('button', { name: '4단계 시기를 앞으로' }).click();
  await expect(headers(page)).toHaveText(['4단계', '2024', '2단계', '3단계']);
  await s.getByRole('button', { name: '4단계 시기 지우기' }).click();
  await expect(headers(page)).toHaveText(['2024', '2단계', '3단계']);

  // 버튼 조작은 한 단계씩 되돌린다(지우기 → 다시 4개)
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(headers(page)).toHaveText(['4단계', '2024', '2단계', '3단계']);
});

test('합계 표시와 배경 띠', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  await expect(chart(page)).toContainText('들어옴 9 명 · 나감 9 명');
  await expect(chart(page).locator('.period-bands rect')).toHaveCount(2);
  await settings(page).getByLabel('시기마다 들어오고 나간 흐름 합계').uncheck();
  await expect(chart(page)).not.toContainText('들어옴 9 명');
  await settings(page).getByLabel('시기 배경 띠와 경계선').uncheck();
  await expect(chart(page).locator('.period-bands')).toHaveCount(0);
});

test('SVG에 시기 머리글, CSV에 시기 열이 들어가고 다시 불러오면 복원된다', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');

  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '내려받기' });
  await dialog.getByLabel(/SVG 벡터/).check();
  await dialog.getByLabel('파일 이름').fill('timeline');
  const [svgDl] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'SVG 내려받기' }).click(),
  ]);
  const svg = readFileSync((await svgDl.path())!, 'utf8');
  for (const label of ['2000', '2005', '2010', '2015', '2020']) {
    expect(svg).toContain(`font-weight="600" fill="#1B1F24">${label}</text>`);
  }
  expect(svg).toContain('stroke-dasharray="4 4"');

  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await dialog.getByLabel(/CSV 데이터/).check();
  await dialog.getByLabel('파일 이름').fill('timeline');
  const [csvDl] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'CSV 내려받기' }).click(),
  ]);
  const csvPath = (await csvDl.path())!;
  expect(readFileSync(csvPath, 'utf8')).toContain('출발 시기,도착 시기');

  // 시기 모드가 꺼진 다른 예시로 바꾼 뒤 다시 불러온다
  await loadSampleUI(page, '사업 예산 배분');
  await expect(headers(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'CSV 가져오기' }).click();
  await page.getByLabel('CSV 파일 선택').setInputFiles({
    name: 'timeline.csv',
    mimeType: 'text/csv',
    buffer: readFileSync(csvPath),
  });
  const imp = page.getByRole('dialog', { name: 'CSV 가져오기' });
  await expect(imp.getByLabel('출발 시기', { exact: true })).toHaveValue('5');
  await expect(imp.getByTestId('import-summary')).toContainText('노드 9개의 시기를 읽었습니다');
  await imp.getByRole('button', { name: '가져오기' }).click();
  await expect(headers(page)).toHaveText(['2000', '2005', '2010', '2015', '2020']);
  await expect(page.getByRole('status').filter({ hasText: '시기를 정했습니다' })).toBeVisible();
});

test('시기 모드에서도 심각한 접근성 위반이 없다', async ({ page }) => {
  await loadSampleUI(page, '시기별 단체 흐름');
  await chart(page).locator('[role="button"][data-period-id]').first().click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});
