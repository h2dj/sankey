import type { Page } from '@playwright/test';

export const chart = (page: Page) => page.getByTestId('sankey-chart');
export const links = (page: Page) => chart(page).locator('[data-link-id]');
export const nodes = (page: Page) => chart(page).locator('[data-node-id]');
export const cell = (page: Page, row: number, column: string) =>
  page.getByRole('textbox', { name: `${row}행 ${column}`, exact: true });
export const issueSummary = (page: Page) => page.getByRole('region', { name: /입력 확인/ });

/** 엑셀에서 복사한 것처럼 탭 구분 텍스트를 붙여넣는다. */
export async function pasteText(page: Page, row: number, column: string, text: string) {
  const target = cell(page, row, column);
  await target.focus();
  await target.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, text);
}

export const loadSampleUI = async (page: Page, name: string) => {
  await page.getByLabel('예시 데이터').selectOption({ label: name });
  await page.getByRole('button', { name: '예시 불러오기' }).click();
};
