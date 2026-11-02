import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// 배포 후 스모크 테스트에서도 쓴다(하위 경로 배포를 위해 './'로 연다).

test('첫 화면: 예시 데이터와 저장 안내가 보인다', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('생키 메이커');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 사업 예산 배분');
  await expect(page.getByText('서버로 전송하지 않습니다')).toBeVisible();
  await expect(page.getByRole('region', { name: '데이터' }).getByRole('row')).toHaveCount(11);
  await expect(page.getByRole('region', { name: '미리보기' })).toBeVisible();
});

test('첫 화면: 심각한 접근성 위반이 없다', async ({ page }) => {
  await page.goto('./');
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
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});

test('글꼴을 불러오고 PNG를 만들 수 있다(하위 경로 배포 확인용)', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px Pretendard', '가'))).toBe(true);
  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await page.getByLabel('파일 이름').fill('smoke');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG 내려받기' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('smoke.png');
  expect(failed).toEqual([]);
});
