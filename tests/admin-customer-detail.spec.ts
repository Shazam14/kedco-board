/**
 * Regression guard for the per-customer detail page (/admin/customers/{id}).
 *
 * Chunk 4 of the customer DB feature — the actual payoff. The whole reason
 * the master list exists is so Ken can drill into a customer and see:
 *   - what they spent in PHP total
 *   - which currencies they touch
 *   - their weekly/annual cadence
 *   - their recent transaction log
 *
 * If any of those surfaces silently goes blank, the master list collapses
 * back to "just a contacts book", losing the value-prop.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const MOCK_API = 'http://localhost:9999';
async function resetMockState(request: import('@playwright/test').APIRequestContext) {
  await request.post(`${MOCK_API}/api/v1/test/reset`);
}

test.describe('Admin customer detail page (/admin/customers/{id})', () => {
  test.beforeEach(async ({ request }) => {
    await resetMockState(request);
  });

  test.describe('admin', () => {
    test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

    test('clicking a name on the list opens the detail page', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('customer-name-link-cust-hannah-wu').click();
      await expect(page).toHaveURL(/\/admin\/customers\/cust-hannah-wu$/);
      await expect(page.getByTestId('detail-name')).toContainText('Hannah Wu');
    });

    test('header + stat cards reflect the seeded customer (Hannah Wu)', async ({ page }) => {
      await page.goto('/admin/customers/cust-hannah-wu');
      await expect(page.getByTestId('detail-name')).toContainText('Hannah Wu');
      await expect(page.getByTestId('detail-stat-volume')).toContainText('₱480,000');
      await expect(page.getByTestId('detail-stat-count')).toContainText('12');
      await expect(page.getByTestId('detail-stat-last')).toContainText('2026-04-29');
      await expect(page.getByTestId('detail-stat-first')).toContainText('2026-04-01');
    });

    test('currency mix table renders one row per currency the customer touched', async ({ page }) => {
      await page.goto('/admin/customers/cust-hannah-wu');
      await expect(page.getByTestId('detail-currency-USD')).toBeVisible();
      await expect(page.getByTestId('detail-currency-JPY')).toBeVisible();
      // Mocked totals roughly: USD 70% of volume, JPY 30%
      await expect(page.getByTestId('detail-currency-USD')).toContainText('₱336,000');
    });

    test('recent transactions table renders the mocked rows', async ({ page }) => {
      await page.goto('/admin/customers/cust-hannah-wu');
      await expect(page.getByTestId('detail-txn-OR-DETAIL-1')).toBeVisible();
      await expect(page.getByTestId('detail-txn-OR-DETAIL-1')).toContainText('SELL');
      await expect(page.getByTestId('detail-txn-OR-DETAIL-2')).toBeVisible();
      await expect(page.getByTestId('detail-txn-OR-DETAIL-2')).toContainText('BUY');
    });

    test('404 customer shows error state, not a crash', async ({ page }) => {
      await page.goto('/admin/customers/cust-does-not-exist');
      await expect(page.getByTestId('detail-error')).toContainText('Customer not found');
    });

    test('breadcrumb back-link returns to the list', async ({ page }) => {
      await page.goto('/admin/customers/cust-hannah-wu');
      await page.getByRole('link', { name: '← Customers' }).click();
      await expect(page).toHaveURL(/\/admin\/customers$/);
    });
  });

  test.describe('access control', () => {
    test('cashier is redirected away', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: path.join('tests', '.auth', 'cashier.json') });
      const page = await ctx.newPage();
      await page.goto('/admin/customers/cust-hannah-wu');
      await expect(page).not.toHaveURL(/\/admin\/customers\/cust-hannah-wu$/);
      await ctx.close();
    });

    test('supervisor can view the detail page', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: path.join('tests', '.auth', 'supervisor.json') });
      const page = await ctx.newPage();
      await page.goto('/admin/customers/cust-hannah-wu');
      await expect(page.getByTestId('detail-name')).toContainText('Hannah Wu');
      await ctx.close();
    });
  });
});
