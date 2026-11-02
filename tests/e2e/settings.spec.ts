import { expect, test, type Page } from '@playwright/test';
import { chart, links, nodes } from './helpers';

const settings = (page: Page) => page.getByRole('region', { name: '설정' });
const rect = (page: Page, id: string) => chart(page).locator(`[data-node-id="${id}"]`);
const label = (page: Page, id: string) => chart(page).locator(`[data-label-for="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(links(page)).toHaveCount(10);
});

test('제목·설명·단위를 바꾸면 미리보기에 반영된다', async ({ page }) => {
  await settings(page).getByLabel('제목').fill('우리 기관 예산');
  await settings(page).getByLabel('값의 단위').fill('억 원');
  await settings(page).getByLabel('설명').fill('2027년 계획안');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('우리 기관 예산');
  await expect(chart(page).locator('title').first()).toHaveText('우리 기관 예산');
  await expect(label(page, '전체 예산')).toHaveText('전체 예산 100 억 원');
  await expect(page.getByRole('region', { name: '미리보기' })).toContainText('2027년 계획안');
  await expect(page.getByRole('columnheader', { name: /값 \(억 원\)/ })).toBeVisible();
});

test('방향을 바꾸면 시작 노드가 오른쪽으로 간다', async ({ page }) => {
  const xBefore = Number(await rect(page, '전체 예산').getAttribute('x'));
  await settings(page).getByLabel('오른쪽 → 왼쪽').check();
  await expect
    .poll(async () => Number(await rect(page, '전체 예산').getAttribute('x')))
    .toBeGreaterThan(xBefore + 500);
});

test('노드 폭·글자 크기 슬라이더', async ({ page }) => {
  const width = settings(page).getByRole('slider', { name: /노드 폭/ });
  await width.fill('30');
  await expect(rect(page, '전체 예산')).toHaveAttribute('width', '30');

  await settings(page)
    .getByRole('slider', { name: /글자 크기/ })
    .fill('20');
  await expect(chart(page)).toHaveAttribute('font-size', '20');
});

test('레이블 값 표시 끄기·소수 자리·바깥쪽 레이블', async ({ page }) => {
  await settings(page).getByLabel('레이블에 값 표시').uncheck();
  await expect(label(page, '전체 예산')).toHaveText('전체 예산');
  await settings(page).getByLabel('레이블에 값 표시').check();

  await settings(page).getByLabel('소수 자리').selectOption('1');
  await expect(label(page, '전체 예산')).toHaveText('전체 예산 100.0 백만 원');

  await settings(page)
    .getByLabel(/바깥쪽/)
    .check();
  await expect(label(page, '전체 예산')).toHaveAttribute('text-anchor', 'end');
});

test('팔레트·노드별 색·흐름 색', async ({ page }) => {
  await settings(page).getByLabel('흙빛').check();
  await expect(rect(page, '전체 예산')).toHaveAttribute('fill', '#8C510A');

  await settings(page).getByLabel('교육 색').fill('#ff0000');
  await expect(rect(page, '교육')).toHaveAttribute('fill', '#FF0000');
  await settings(page).getByRole('button', { name: '교육 색을 자동으로' }).click();
  await expect(rect(page, '교육')).not.toHaveAttribute('fill', '#FF0000');

  await settings(page).getByLabel('출발 → 도착 그라데이션').check();
  await expect(chart(page).locator('linearGradient')).toHaveCount(10);
  await expect(links(page).first()).toHaveAttribute('stroke', /^url\(#/);
});

test('색상 그룹 기준이면 같은 그룹 노드는 같은 색', async ({ page }) => {
  await settings(page).getByLabel('색상 그룹마다').check();
  await expect
    .poll(async () => {
      const [a, b, c] = await Promise.all(
        ['교육', '운영', '강사비'].map((id) => rect(page, id).getAttribute('fill')),
      );
      return a === b && a !== c;
    })
    .toBe(true);
});

test('중복 처리를 별도 흐름으로 바꾼다', async ({ page }) => {
  await page.getByRole('textbox', { name: '4행 도착 노드', exact: true }).fill('교육');
  await expect(links(page)).toHaveCount(9);
  await settings(page).getByLabel('별도 흐름으로 표시').check();
  await expect(links(page)).toHaveCount(10);
  await expect(nodes(page)).toHaveCount(10);
});

test('설정 변경도 실행 취소된다', async ({ page }) => {
  await settings(page).getByLabel('오른쪽 → 왼쪽').check();
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(settings(page).getByLabel('왼쪽 → 오른쪽')).toBeChecked();
});

test('설정 섹션을 접을 수 있다', async ({ page }) => {
  const summary = settings(page).getByText('레이아웃', { exact: true });
  await summary.click();
  await expect(settings(page).getByRole('slider', { name: /노드 폭/ })).toBeHidden();
});
