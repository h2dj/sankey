import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { cell, links } from './helpers';

const panel = (page: import('@playwright/test').Page) => page.getByTestId('observe-panel');

test('평소에는 관찰 패널이 없다', async ({ page }) => {
  await page.goto('./');
  await expect(links(page)).toHaveCount(10);
  await expect(panel(page)).toHaveCount(0);
});

test('관찰 모드: 과제별 시간·오류·내려받기를 기록하고, 내용은 남기지 않는다', async ({ page }) => {
  await page.goto('./?observe=1');
  await expect(panel(page)).toBeVisible();

  await panel(page).getByLabel('과제').selectOption('1');
  await panel(page).getByRole('button', { name: '시작' }).click();
  await expect(panel(page)).toContainText('과제 1');

  // 숫자 오류를 냈다가 고친다
  await cell(page, 1, '값').fill('사십');
  await expect(page.getByRole('region', { name: /입력 확인/ })).toContainText('오류 1건');
  await cell(page, 1, '값').fill('40');
  await expect(page.getByRole('region', { name: /입력 확인/ })).toContainText('입력 문제 없음');
  await page.getByRole('region', { name: '설정' }).getByLabel('제목').fill('비밀 제목 XYZ');

  // PNG 내려받기
  await page.getByRole('button', { name: '내려받기', exact: true }).click();
  await page.getByLabel('파일 이름').fill('task1');
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG 내려받기' }).click(),
  ]);

  await panel(page).getByRole('button', { name: '성공' }).click();
  const row = panel(page).getByRole('row').nth(1);
  await expect(row).toContainText('성공');
  await expect(row).toContainText('1(1)'); // 오류 1건, 해결 1건
  await expect(row).toContainText('png');

  // 새로고침해도 기록이 남는다(같은 탭)
  await page.reload();
  await expect(panel(page).getByRole('row').nth(1)).toContainText('성공');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel(page).getByRole('button', { name: '기록 내려받기' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^observation-\d{12}\.json$/);
  const text = readFileSync((await download.path())!, 'utf8');
  const log = JSON.parse(text);
  expect(log.tasks[0]).toMatchObject({
    task: 1,
    result: 'success',
    errorsShown: 1,
    errorsResolved: 1,
    exports: ['png'],
  });
  expect(log.tasks[0].edits).toBeGreaterThanOrEqual(2);
  const names = log.events.map((e: { name: string }) => e.name);
  expect(names).toEqual(
    expect.arrayContaining([
      'session_start',
      'task_start',
      'error_shown',
      'error_resolved',
      'export',
      'task_end',
      'restored',
    ]),
  );
  // 입력 내용(값·제목·노드 이름·파일 이름)이 기록에 없어야 한다
  for (const secret of ['사십', '비밀 제목', '전체 예산', '교육', 'task1', '2026년']) {
    expect(text).not.toContain(secret);
  }
});

test('?observe=0이면 관찰을 끝내고 기록을 지운다', async ({ page }) => {
  await page.goto('./?observe=1');
  await expect(panel(page)).toBeVisible();
  await page.goto('./?observe=0');
  await expect(links(page)).toHaveCount(10);
  await expect(panel(page)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});
