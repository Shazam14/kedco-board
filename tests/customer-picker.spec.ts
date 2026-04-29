/**
 * Regression guard for the loyal-customer autocomplete picker.
 *
 * The picker replaces the old free-text customer input on cashier/rider/admin
 * transaction forms. Two invariants matter:
 *   1. Picking from the autocomplete dropdown sets BOTH the visible name and
 *      a hidden `customer_id` FK that is sent on the next transaction POST.
 *      Without that, per-customer rollups (the whole reason the master list
 *      exists) silently aggregate to nothing.
 *   2. The walk-in path is preserved: typing freely without picking still
 *      submits, with `customer_id` absent — the txn falls back to free-text.
 *
 * The "+ Add" affordance is what makes this low-friction for cashiers/riders
 * who are with the customer; if it stops appearing or stops POSTing, the
 * feature collapses back to the old text-only behavior.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

const DISPATCH = {
  dispatch: {
    id: 'DISP-CUST-001',
    cash_php: 50000,
    status: 'IN_FIELD',
    dispatch_time: '09:00 AM',
    topups: [],
  },
};

const SUGGESTIONS = [
  { id: 'cust-hannah-wu',  name: 'Hannah Wu',  phone: '09171234567' },
  { id: 'cust-hanna-wuu',  name: 'Hanna Wuu',  phone: null },
];

test.describe('Customer picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/rider/dispatch', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DISPATCH) })
    );
    await page.route('/api/rider/transactions', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('/api/rider/borrow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    // Autocomplete: filter by query like the real backend does (case-insensitive substring)
    await page.route(/\/api\/customers(\?.*)?$/, route => {
      const u = new URL(route.request().url());
      const q = (u.searchParams.get('q') ?? '').trim().toLowerCase();
      const filtered = q
        ? SUGGESTIONS.filter(s => s.name.toLowerCase().includes(q))
        : SUGGESTIONS;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(filtered) });
    });
    await page.goto('/rider');
    await page.getByRole('button', { name: 'SELL', exact: true }).click();
  });

  test('typing surfaces matches; picking links a customer (LINKED badge appears)', async ({ page }) => {
    const picker = page.getByTestId('customer-picker');
    const input = picker.locator('input').first();

    await input.fill('hann');
    const dropdown = page.getByTestId('customer-picker-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('Hannah Wu');
    await expect(dropdown).toContainText('Hanna Wuu');

    // Pick the first match
    await page.getByRole('button', { name: /Hannah Wu/ }).first().click();

    await expect(input).toHaveValue('Hannah Wu');
    await expect(page.getByTestId('customer-picker-linked')).toBeVisible();
    // Dropdown closes after pick
    await expect(dropdown).toHaveCount(0);
  });

  test('editing after picking severs the FK link (LINKED badge disappears)', async ({ page }) => {
    const picker = page.getByTestId('customer-picker');
    const input = picker.locator('input').first();

    await input.fill('hann');
    await page.getByRole('button', { name: /Hannah Wu/ }).first().click();
    await expect(page.getByTestId('customer-picker-linked')).toBeVisible();

    // Edit one character — link breaks (back to walk-in path)
    await input.press('End');
    await input.press('!');
    await expect(page.getByTestId('customer-picker-linked')).toHaveCount(0);
  });

  test('"+ Add" affordance appears only for non-matching text and creates+links on click', async ({ page }) => {
    let postedBody: Record<string, unknown> | null = null;
    await page.route('/api/customers', async route => {
      if (route.request().method() === 'POST') {
        postedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({
            id: 'cust-newly-created', name: postedBody!.name, phone: null,
            is_active: true, created_by: 'ridertest',
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    const picker = page.getByTestId('customer-picker');
    const input = picker.locator('input').first();

    await input.fill('Brand New Person');
    const addBtn = page.getByTestId('customer-picker-add');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // POST sent with the trimmed name
    await expect.poll(() => postedBody).not.toBeNull();
    expect(postedBody!.name).toBe('Brand New Person');

    // Newly-created customer is now linked
    await expect(input).toHaveValue('Brand New Person');
    await expect(page.getByTestId('customer-picker-linked')).toBeVisible();
  });

  test('walk-in: typing free-text without picking leaves the FK unlinked', async ({ page }) => {
    const input = page.getByTestId('customer-picker').locator('input').first();
    await input.fill('Some Walk In');
    // Click outside to dismiss the dropdown without picking
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await expect(input).toHaveValue('Some Walk In');
    await expect(page.getByTestId('customer-picker-linked')).toHaveCount(0);
  });
});
