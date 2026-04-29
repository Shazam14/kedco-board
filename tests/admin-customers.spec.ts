/**
 * Regression guard for the admin Customers list page (/admin/customers).
 *
 * Chunk 3a of the customer DB feature — the first place an admin can browse
 * who their loyal customers are. The whole point of building the master list
 * was the per-customer aggregates (volume, txn count, last seen). If the
 * enriched API silently drops or the page silently stops calling it,
 * Ken loses the "who are my biggest customers" view.
 *
 * Merge UI + per-customer detail page ship in chunks 3b and 4.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Admin Customers list page (/admin/customers)', () => {

  test.describe('admin role', () => {
    test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

    test('renders heading + summary cards aggregated from rows', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page.getByText('Customer Master List')).toBeVisible();

      // Summary cards reflect the mocked CUSTOMERS state (Hannah=12 txns/₱480K + Pedro=3/₱95K)
      await expect(page.getByTestId('summary-customers')).toContainText('2');
      await expect(page.getByTestId('summary-total-txns')).toContainText('15');
      await expect(page.getByTestId('summary-total-volume')).toContainText('₱575,000');
    });

    test('table shows customer rows sorted by volume desc by default', async ({ page }) => {
      await page.goto('/admin/customers');
      const hannahRow = page.getByTestId('customer-row-cust-hannah-wu');
      const pedroRow  = page.getByTestId('customer-row-cust-pedro-cruz');

      await expect(hannahRow).toBeVisible();
      await expect(hannahRow).toContainText('Hannah Wu');
      await expect(hannahRow).toContainText('09171234567');
      await expect(hannahRow).toContainText('12');
      await expect(hannahRow).toContainText('₱480,000');

      await expect(pedroRow).toBeVisible();
      await expect(pedroRow).toContainText('Pedro Cruz');
      await expect(pedroRow).toContainText('₱95,000');

      // DOM order: Hannah (480K) BEFORE Pedro (95K)
      const all = await page.locator('[data-testid^="customer-row-"]').all();
      const ids = await Promise.all(all.map(r => r.getAttribute('data-testid')));
      expect(ids).toEqual(['customer-row-cust-hannah-wu', 'customer-row-cust-pedro-cruz']);
    });

    test('search box filters by name', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('customers-search').fill('pedro');
      // Debounced/network — wait for Hannah row to disappear
      await expect(page.getByTestId('customer-row-cust-hannah-wu')).toHaveCount(0);
      await expect(page.getByTestId('customer-row-cust-pedro-cruz')).toBeVisible();
    });

    test('search with no matches shows the empty-state message', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('customers-search').fill('zzzz-no-such-customer');
      await expect(page.getByTestId('customers-empty')).toContainText('No customers matching');
    });

    test('admin panel exposes Customers card linking here', async ({ page }) => {
      await page.goto('/admin');
      const link = page.getByRole('link', { name: /Customers/ });
      await expect(link.first()).toBeVisible();
      await link.first().click();
      await expect(page).toHaveURL(/\/admin\/customers$/);
      await expect(page.getByText('Customer Master List')).toBeVisible();
    });
  });

  test.describe('access control', () => {
    test('cashier is redirected away', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: path.join('tests', '.auth', 'cashier.json') });
      const page = await ctx.newPage();
      await page.goto('/admin/customers');
      await expect(page).not.toHaveURL(/\/admin\/customers$/);
      await ctx.close();
    });

    test('supervisor can access (admin+supervisor allowed at API)', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: path.join('tests', '.auth', 'supervisor.json') });
      const page = await ctx.newPage();
      await page.goto('/admin/customers');
      await expect(page.getByText('Customer Master List')).toBeVisible();
      await ctx.close();
    });
  });
});
