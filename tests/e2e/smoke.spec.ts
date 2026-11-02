import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('첫 화면: 예시 데이터와 저장 안내가 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('생키 메이커');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 사업 예산 배분');
  await expect(page.getByText('서버로 전송하지 않습니다')).toBeVisible();
  await expect(page.getByRole('region', { name: '데이터' }).getByRole('row')).toHaveCount(11);
  await expect(page.getByRole('region', { name: '미리보기' })).toBeVisible();
});

test('첫 화면: 심각한 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('외부 도메인으로 요청을 보내지 않는다', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== new URL(baseURL!).origin && url.protocol.startsWith('http')) {
      external.push(req.url());
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});
