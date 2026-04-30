/**
 * Phase 4 — split-aware daily report (/admin/report).
 *
 * What this guards:
 *   • By Payment Method card renders one row per slice method, with split
 *     by direction (BUY # / SELL #) and a PENDING column for SELLs.
 *   • Multi-slice transaction in the log gets a SPLIT +N chip and inline
 *     sub-rows showing each slice (method, amount, status, ref#).
 *   • Single-slice transactions stay as one row (no expansion noise).
 *
 * The /admin/report page is server-rendered with the cookie token, so the
 * test server proxies to mock-api at localhost:9999. The mock-api fixture
 * for /api/v1/report/daily includes one multi-slice SELL (CASH RECEIVED +
 * GCASH PENDING) so all of the Phase 4 surface area is exercised end-to-end.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Admin daily report — split-aware (Phase 4)', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/report');
  });

  test('By Payment Method card renders with per-method rows', async ({ page }) => {
    const card = page.getByTestId('report-by-method');
    await expect(card).toBeVisible();
    await expect(card.getByText('By Payment Method')).toBeVisible();

    // CASH row: 2 buys ₱46,250, 1 sell ₱7,600, no pending.
    const cash = page.getByTestId('method-row-CASH');
    await expect(cash).toContainText('CASH');
    await expect(cash).toContainText('46,250');
    await expect(cash).toContainText('7,600');

    // GCASH row: 0 buys, 1 sell ₱3,600 — all pending.
    const gcash = page.getByTestId('method-row-GCASH');
    await expect(gcash).toContainText('GCASH');
    await expect(gcash).toContainText('3,600');
  });

  test('multi-slice SELL shows SPLIT chip + expanded slice sub-rows', async ({ page }) => {
    // The multi-slice fixture is TXN-003 (SELL USD ₱11,200, CASH+GCASH).
    await expect(page.getByTestId('split-chip-TXN-003')).toContainText('SPLIT +1');

    const cashSlice  = page.getByTestId('slice-row-TXN-003-CASH');
    const gcashSlice = page.getByTestId('slice-row-TXN-003-GCASH');
    await expect(cashSlice).toBeVisible();
    await expect(gcashSlice).toBeVisible();

    await expect(cashSlice).toContainText('7,600');
    await expect(cashSlice).toContainText('RECEIVED');
    await expect(gcashSlice).toContainText('3,600');
    await expect(gcashSlice).toContainText('PENDING');
    await expect(gcashSlice).toContainText('GC-MS-1');
  });

  test('single-slice transactions stay as one row (no expansion)', async ({ page }) => {
    // TXN-001 and TXN-002 are single-slice — no expansion, no chip.
    await expect(page.getByTestId('split-chip-TXN-001')).toHaveCount(0);
    await expect(page.getByTestId('slice-row-TXN-001-CASH')).toHaveCount(0);
    await expect(page.getByTestId('split-chip-TXN-002')).toHaveCount(0);
  });
});
