import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('four-up preset renders four complete labels and preserves custom dimensions on reload', async ({
  page,
}, testInfo) => {
  await page.goto('');
  await page.getByRole('button', { name: '列印設定', exact: false }).first().click();
  await page.getByLabel('列印張數（1–100）').fill('1');
  await page.getByRole('button', { name: /四張直式 · 每頁 4 張/ }).click();
  await expect(page.getByLabel('標籤寬度（mm）')).toHaveValue('92');
  await expect(page.getByLabel('標籤高度（mm）')).toHaveValue('135');
  await expect(page.getByLabel('列印張數（1–100）')).toHaveValue('4');
  await expect(
    page.getByText('本次 4 張 · 每頁最多 4 張 · 共 1 頁', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('列印張數（1–100）').fill('5');
  await expect(
    page.getByText('本次 5 張 · 每頁最多 4 張 · 共 2 頁', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /四張直式 · 每頁 4 張/ }).click();
  await expect(page.getByLabel('列印張數（1–100）')).toHaveValue('4');
  await page.getByLabel('有效日期 *').fill('2099-12-31');
  await page.getByText('我已確認這一批的有效日期', { exact: true }).click();
  await page.getByRole('button', { name: '更新預覽', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered', '1:1', { timeout: 45000 });
  const canvasPng = await page
    .locator('canvas')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  await writeFile(
    testInfo.outputPath('four-up.png'),
    Buffer.from(canvasPng.split(',')[1], 'base64'),
  );
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載草稿 PDF' }).click();
  await (await downloadEvent).saveAs(testInfo.outputPath('four-up.pdf'));
  await page.getByLabel('標籤寬度（mm）').fill('91');
  await expect(page.getByText('自訂尺寸', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下載草稿 PDF' })).toBeDisabled();
  await expect(page.getByText('已儲存在此瀏覽器', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '列印設定', exact: false }).first().click();
  await expect(page.getByLabel('標籤寬度（mm）')).toHaveValue('91');
  await page.getByRole('button', { name: /大版單張 · 每頁 1 張/ }).click();
  await expect(page.getByLabel('列印張數（1–100）')).toHaveValue('1');
  await page.getByRole('button', { name: /加寬雙張 · 每頁 2 張/ }).click();
  await expect(page.getByLabel('列印張數（1–100）')).toHaveValue('2');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('root workflow renders PDF with embedded Chinese, download and stale invalidation', async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    badAssets: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) badAssets.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('');
  await expect(page.getByRole('heading', { name: '把好味道，貼上好標籤。' })).toBeVisible();
  await page.getByRole('button', { name: '列印設定', exact: false }).first().click();
  await page.getByLabel('有效日期 *').fill('2099-12-31');
  await page.getByText('我已確認這一批的有效日期', { exact: true }).click();
  await page.getByRole('button', { name: '更新預覽', exact: true }).click();
  await expect(page.getByRole('button', { name: '下載草稿 PDF' })).toBeEnabled({ timeout: 45000 });
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered', '1:1', { timeout: 30000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載草稿 PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('easylabel-2099-12-31-draft.pdf');
  await download.saveAs(testInfo.outputPath('sample-draft.pdf'));
  await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
  const canvasPng = await page
    .locator('canvas')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png'));
  await writeFile(
    testInfo.outputPath('a4-render.png'),
    Buffer.from(canvasPng.split(',')[1], 'base64'),
  );
  await page.getByLabel('有效日期 *').fill('2099-12-30');
  await expect(page.getByRole('button', { name: '下載草稿 PDF' })).toBeDisabled();
  await expect(page.getByText('資料已變更，請更新預覽。')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '我已確認這一批的有效日期' })).not.toBeChecked();
  expect(errors).toEqual([]);
  expect(badAssets).toEqual([]);
});

test('product persistence, duplication, switching resets batch, safe deletion', async ({
  page,
}) => {
  await page.goto('');
  await page.getByLabel('品名 *', { exact: true }).fill('測試芝麻餅乾');
  await expect(page.getByText('已儲存在此瀏覽器')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('測試芝麻餅乾');
  await page.getByRole('button', { name: '複製商品', exact: true }).click();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('測試芝麻餅乾（副本）');
  await expect(
    page.getByRole('checkbox', { name: '已確認原料依實際含量，由多至少排列' }),
  ).not.toBeChecked();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '刪除商品', exact: true }).click();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('測試芝麻餅乾');
});

test('sorting ingredients invalidates confirmation and missing compound evidence is visible', async ({
  page,
}) => {
  await page.goto('');
  await page.getByRole('button', { name: '原料 1 下移', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '原料 1', exact: true })).toHaveValue('奶油');
  await expect(
    page.getByRole('checkbox', { name: '已確認原料依實際含量，由多至少排列' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: '檢查與下載', exact: false }).first().click();
  await expect(page.getByText('請確認原料已依實際含量由多至少排列。')).toBeVisible();
});

test('nutrition thresholds display blocked zero labels without changing originals', async ({
  page,
}) => {
  await page.goto('');
  await page.getByRole('button', { name: '營養標示', exact: false }).first().click();
  await page.getByRole('textbox', { name: '脂肪每100公克', exact: true }).fill('0.51');
  await page.getByRole('checkbox', { name: '脂肪印為零', exact: true }).check();
  await page.getByRole('button', { name: '檢查與下載', exact: false }).first().click();
  await expect(
    page.getByText('脂肪不符合每份及每100公克的零標示條件。', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '營養標示', exact: false }).first().click();
  await expect(page.getByRole('textbox', { name: '脂肪每100公克', exact: true })).toHaveValue(
    '0.51',
  );
});

test('corrupt import is rejected without destroying product', async ({ page }) => {
  await page.goto('');
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.getByRole('status').filter({ hasText: '備份格式或版本不相容' })).toBeVisible();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('原味奶油餅乾');
});

test('local storage failures preserve in-memory data and permit backup', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await page.goto('');
  await page.getByLabel('品名 *', { exact: true }).fill('仍在編輯');
  await expect(page.getByText('儲存失敗', { exact: true })).toBeVisible();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('仍在編輯');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份' }).click();
  expect((await event).suggestedFilename()).toBe('easylabel-backup.json');
});

test('unsupported scope and overflowing content stay blocked or draft', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: '適用範圍', exact: false }).first().click();
  await page.getByLabel('保存型態').selectOption('frozen');
  await page.getByRole('button', { name: '檢查與下載', exact: false }).first().click();
  await expect(page.getByText('第一版僅支援非真空、常溫或冷藏包裝。')).toBeVisible();
  await page.getByRole('button', { name: '商品資料', exact: false }).first().click();
  await page.getByLabel('廠商地址 *').fill('很長的地址'.repeat(80));
  await page.getByRole('button', { name: '更新預覽', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('需要約', { timeout: 45000 });
  await expect(page.getByRole('button', { name: '下載草稿 PDF' })).toBeDisabled();
});

test('mobile editing and backup fit screen without horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await expect(page.getByRole('heading', { name: '把好味道，貼上好標籤。' })).toBeVisible();
  await page.getByLabel('品名 *', { exact: true }).fill('手機測試餅乾');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '4. 營養標示', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '熱量每份', exact: true })).toBeVisible();
});

test('invalid paper inputs do not corrupt saved products on reload', async ({ page }) => {
  await page.goto('');
  await page.getByLabel('品名 *', { exact: true }).fill('尺寸測試商品');
  await page.getByRole('button', { name: '列印設定', exact: false }).first().click();
  await page.getByLabel('標籤寬度（mm）').fill('0');
  await expect(page.getByText('商品已儲存，尺寸待修正')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('品名 *', { exact: true })).toHaveValue('尺寸測試商品');
  await page.getByRole('button', { name: '列印設定', exact: false }).first().click();
  await expect(page.getByLabel('標籤寬度（mm）')).toHaveValue('120');
});
