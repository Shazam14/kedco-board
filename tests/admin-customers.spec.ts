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

const MOCK_API = 'http://localhost:9999';
async function resetMockState(request: import('@playwright/test').APIRequestContext) {
  await request.post(`${MOCK_API}/api/v1/test/reset`);
}

test.describe('Admin Customers list page (/admin/customers)', () => {
  test.beforeEach(async ({ request }) => {
    await resetMockState(request);
  });

  test.describe('admin role', () => {
    test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

    test('renders heading + summary cards aggregated from rows', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page.getByText('Customer Master List')).toBeVisible();

      // Summary cards reflect the mocked CUSTOMERS state:
      //   Hannah Wu (12 txns / ₱480K) + Pedro Cruz (3 / ₱95K) + Hanna Wuu (2 / ₱18K)
      await expect(page.getByTestId('summary-customers')).toContainText('3');
      await expect(page.getByTestId('summary-total-txns')).toContainText('17');
      await expect(page.getByTestId('summary-total-volume')).toContainText('₱593,000');
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

      // DOM order: Hannah (480K) BEFORE Pedro (95K) BEFORE Hanna Wuu (18K)
      const all = await page.locator('[data-testid^="customer-row-"]').all();
      const ids = await Promise.all(all.map(r => r.getAttribute('data-testid')));
      expect(ids).toEqual([
        'customer-row-cust-hannah-wu',
        'customer-row-cust-pedro-cruz',
        'customer-row-cust-hanna-wuu',
      ]);
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

  test.describe('merge flow (admin only)', () => {
    test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

    test('select 2 rows → MERGE bar → modal → confirm collapses dupes into canonical', async ({ page }) => {
      await page.goto('/admin/customers');

      // Pick Hannah Wu + Hanna Wuu (the suspected dupe seeded in makeInitialCustomers)
      await page.getByTestId('select-cust-hannah-wu').check();
      await page.getByTestId('select-cust-hanna-wuu').check();

      // Floating action bar surfaces with the count + MERGE button
      await expect(page.getByTestId('merge-bar')).toBeVisible();
      await expect(page.getByTestId('merge-bar')).toContainText('2 customers selected');
      await page.getByTestId('open-merge').click();

      // Modal opens; default canonical = highest-volume (Hannah Wu @ ₱480K, NOT Hanna Wuu @ ₱18K)
      const modal = page.getByTestId('merge-modal');
      await expect(modal).toBeVisible();
      const hannahRadio = modal.getByTestId('canonical-radio-cust-hannah-wu').locator('input');
      await expect(hannahRadio).toBeChecked();

      // Confirm
      await page.getByTestId('confirm-merge').click();

      // Modal closes, table refetches — Hanna Wuu disappears, Hannah Wu's totals roll up
      await expect(page.getByTestId('merge-modal')).toHaveCount(0);
      await expect(page.getByTestId('customer-row-cust-hanna-wuu')).toHaveCount(0);
      const hannahRow = page.getByTestId('customer-row-cust-hannah-wu');
      await expect(hannahRow).toContainText('14');                     // 12 + 2 txns
      await expect(hannahRow).toContainText('₱498,000');               // ₱480K + ₱18K

      // Summary cards reflect the collapse: now 2 active customers, 17 total txns, ₱593K volume
      await expect(page.getByTestId('summary-customers')).toContainText('2');
      await expect(page.getByTestId('summary-total-txns')).toContainText('17');
    });

    test('user can change the canonical via the radio inside the modal', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('select-cust-hannah-wu').check();
      await page.getByTestId('select-cust-hanna-wuu').check();
      await page.getByTestId('open-merge').click();

      // Flip canonical to the dupe (unusual, but allowed)
      await page.getByTestId('canonical-radio-cust-hanna-wuu').click();
      await page.getByTestId('confirm-merge').click();

      // Hanna Wuu becomes the surviving row, Hannah Wu disappears
      await expect(page.getByTestId('customer-row-cust-hannah-wu')).toHaveCount(0);
      await expect(page.getByTestId('customer-row-cust-hanna-wuu')).toBeVisible();
    });

    test('include-inactive shows merged dupes with INACTIVE badge', async ({ page, request }) => {
      // Pre-merge via the API so we don't have to drive the UI twice
      await request.post(`${MOCK_API}/api/v1/admin/customers/cust-hannah-wu/merge`, {
        data: { duplicate_ids: ['cust-hanna-wuu'] },
      });
      await page.goto('/admin/customers');

      // Default view: dupe hidden
      await expect(page.getByTestId('customer-row-cust-hanna-wuu')).toHaveCount(0);

      // Toggle include inactive → dupe reappears with INACTIVE badge
      await page.getByTestId('customers-include-inactive').check();
      const dupeRow = page.getByTestId('customer-row-cust-hanna-wuu');
      await expect(dupeRow).toBeVisible();
      await expect(dupeRow).toContainText('INACTIVE');
    });

    test('inactive rows have their checkbox disabled (cannot be selected for merge)', async ({ page, request }) => {
      await request.post(`${MOCK_API}/api/v1/admin/customers/cust-hannah-wu/merge`, {
        data: { duplicate_ids: ['cust-hanna-wuu'] },
      });
      await page.goto('/admin/customers');
      await page.getByTestId('customers-include-inactive').check();

      const dupeCheckbox = page.getByTestId('select-cust-hanna-wuu');
      await expect(dupeCheckbox).toBeDisabled();
    });

    test('cannot merge fewer than 2 — selecting one keeps the bar hidden', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('select-cust-hannah-wu').check();
      await expect(page.getByTestId('merge-bar')).toHaveCount(0);
    });
  });

  test.describe('merge UI hidden for supervisor', () => {
    test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

    test('supervisor sees the list but no checkboxes / merge bar', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page.getByText('Customer Master List')).toBeVisible();
      // No select checkboxes rendered for supervisor (canMerge=false)
      await expect(page.getByTestId('select-cust-hannah-wu')).toHaveCount(0);
    });
  });

  test.describe('add customer (admin only)', () => {
    test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

    test('admin can seed a new customer from the list page', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('open-add-customer').click();

      const modal = page.getByTestId('add-customer-modal');
      await expect(modal).toBeVisible();

      await modal.getByTestId('add-customer-name').fill('Maria Santos');
      await modal.getByTestId('add-customer-phone').fill('09181112222');
      await modal.getByTestId('add-customer-notes').fill('regular USD seller');
      await modal.getByTestId('confirm-add-customer').click();

      // Modal closes, list reloads with the new row
      await expect(page.getByTestId('add-customer-modal')).toHaveCount(0);
      // New row id is generated server-side; find by name text
      await expect(page.getByText('Maria Santos')).toBeVisible();
      // Summary card customer count bumps from 3 → 4
      await expect(page.getByTestId('summary-customers')).toContainText('4');
    });

    test('blank name shows inline error and does not POST', async ({ page }) => {
      await page.goto('/admin/customers');
      await page.getByTestId('open-add-customer').click();
      // Confirm button stays disabled with blank name
      await expect(page.getByTestId('confirm-add-customer')).toBeDisabled();
    });
  });

  test.describe('add customer hidden for supervisor', () => {
    test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

    test('supervisor does NOT see the + NEW CUSTOMER button', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page.getByText('Customer Master List')).toBeVisible();
      await expect(page.getByTestId('open-add-customer')).toHaveCount(0);
    });
  });
});
