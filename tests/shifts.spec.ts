/**
 * Teller Shift — Playwright tests.
 *
 * Covers the full shift lifecycle on the counter screen and the admin
 * /admin/shifts monitoring page.
 *
 * Mock API state (set in tests/setup/mock-api.mjs):
 *   cashier1 → starts with an OPEN shift (so existing counter tests still pass)
 *
 * For "no active shift" tests we intercept /api/counter/shift at the browser
 * level — the client-side fetch in CounterShell is interceptable via page.route().
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const MOCK_API = 'http://localhost:9999';
async function resetMockState(request: import('@playwright/test').APIRequestContext) {
  await request.post(`${MOCK_API}/api/v1/test/reset`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Intercept the client-side shift check and return 404 (no active shift). */
async function interceptNoShift(page: import('@playwright/test').Page) {
  await page.route('/api/counter/shift', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'No active shift.' }),
      });
    } else {
      await route.continue();
    }
  });
}

const MOCK_OPEN_SHIFT = {
  id: 'shift-test-123',
  date: new Date().toISOString().split('T')[0],
  cashier: 'cashier1',
  cashier_name: 'Cashier One',
  status: 'OPEN',
  opened_at: new Date().toISOString(),
  closed_at: null,
  opening_cash_php: 10000,
  closing_cash_php: null,
  expected_cash_php: null,
  cash_variance: null,
  txn_count: 0,
  total_sold_php: 0,
  total_bought_php: 0,
  total_than: 0,
};

// ── Counter — shift already open ──────────────────────────────────────────────
test.describe('Counter — shift already open', () => {
  test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

  test.beforeEach(async ({ page, request }) => {
    await resetMockState(request);
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/counter');
  });

  test('counter loads normally when shift is open', async ({ page }) => {
    await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
    await expect(page.getByText('Open Your Shift')).not.toBeVisible();
  });

  test('END SHIFT button is visible in nav', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'END SHIFT' })).toBeVisible();
  });

  test('clicking END SHIFT opens the close-shift modal', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await expect(page.getByText('Close Your Shift')).toBeVisible();
  });

  test('end shift modal shows shift summary fields', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await expect(page.getByText('Opening Cash')).toBeVisible();
    await expect(page.getByText('ACTUAL CLOSING CASH (PHP)')).toBeVisible();
    await expect(page.getByTestId('closing-cash-input')).toBeVisible();
  });

  test('close shift modal can be dismissed with ✕', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await expect(page.getByText('Close Your Shift')).toBeVisible();
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('Close Your Shift')).not.toBeVisible();
    await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
  });

  test('CLOSE SHIFT button is disabled until cash is entered', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await expect(page.getByRole('button', { name: 'CLOSE SHIFT' })).toBeDisabled();
    await page.getByTestId('closing-cash-input').fill('27500');
    await expect(page.getByRole('button', { name: 'CLOSE SHIFT' })).toBeEnabled();
  });

  test('entering closing cash and submitting closes the shift', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await page.getByTestId('closing-cash-input').fill('27500');
    await page.getByRole('button', { name: 'CLOSE SHIFT' }).click();

    await expect(page.getByText('SHIFT CLOSED')).toBeVisible();
    await expect(page.getByText('Shift Summary')).toBeVisible();
    await expect(page.getByText('Variance')).toBeVisible();
  });

  test('shift summary after close shows logout button', async ({ page }) => {
    // Intercept to guarantee an open shift regardless of prior test state
    const openShift = { ...MOCK_OPEN_SHIFT, txn_count: 3, total_sold_php: 29000, total_bought_php: 11500 };
    const closedShift = { ...openShift, status: 'CLOSED', closed_at: new Date().toISOString(),
      closing_cash_php: 27500, expected_cash_php: 27500, cash_variance: 0 };

    await page.route('/api/counter/shift', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(closedShift) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(openShift) });
      }
    });

    await page.goto('/counter');
    await page.getByRole('button', { name: 'END SHIFT' }).click();
    await page.getByTestId('closing-cash-input').fill('27500');
    await page.getByRole('button', { name: 'CLOSE SHIFT' }).click();

    await expect(page.getByText('SHIFT CLOSED')).toBeVisible();
    // Two LOGOUT buttons render (summary card + nav) — check the summary card one
    await expect(page.getByRole('button', { name: 'LOGOUT' }).first()).toBeVisible();
  });
});

// ── Counter — no active shift (open shift overlay) ────────────────────────────
test.describe('Counter — no active shift (open shift overlay)', () => {
  test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

  test('shows open shift overlay when no active shift', async ({ page }) => {
    await interceptNoShift(page);
    await page.goto('/counter');

    await expect(page.getByText('Open Your Shift')).toBeVisible();
    await expect(page.getByText('START SHIFT')).toBeVisible();
    // Overlay is blocking the counter — END SHIFT must not appear
    await expect(page.getByRole('button', { name: 'END SHIFT' })).not.toBeVisible();
  });

  test('open shift overlay has opening cash input and OPEN SHIFT button', async ({ page }) => {
    await interceptNoShift(page);
    await page.goto('/counter');

    await expect(page.getByTestId('opening-cash-input')).toBeVisible();
    await expect(page.getByRole('button', { name: 'OPEN SHIFT' })).toBeVisible();
  });

  test('OPEN SHIFT button is disabled until cash is entered', async ({ page }) => {
    await interceptNoShift(page);
    await page.goto('/counter');

    const openBtn = page.getByRole('button', { name: 'OPEN SHIFT' });
    await expect(openBtn).toBeDisabled();
    await page.getByTestId('opening-cash-input').fill('10000');
    await expect(openBtn).toBeEnabled();
  });

  test('opening a shift dismisses the overlay', async ({ page }) => {
    let shiftOpened = false;

    await page.route('/api/counter/shift', async route => {
      if (route.request().method() === 'GET') {
        if (!shiftOpened) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'No active shift.' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_OPEN_SHIFT),
          });
        }
      } else if (route.request().method() === 'POST') {
        shiftOpened = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_OPEN_SHIFT),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/counter');

    await expect(page.getByText('Open Your Shift')).toBeVisible();
    await page.getByTestId('opening-cash-input').fill('10000');
    await page.getByRole('button', { name: 'OPEN SHIFT' }).click();

    // Overlay dismissed — END SHIFT button should appear in nav
    await expect(page.getByText('Open Your Shift')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'END SHIFT' })).toBeVisible();
  });
});

// ── Admin shifts page ─────────────────────────────────────────────────────────
test.describe('Admin — /admin/shifts', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  const FIXED_SHIFTS = [
    {
      id: 'shift-cashier1-fixed', date: new Date().toISOString().split('T')[0],
      cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
      opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
      opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
      txn_count: 3, total_sold_php: 29000, total_bought_php: 11500, total_than: 450, total_commission: 0,
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Intercept with fixed data so these tests are immune to mock-api state changes
    await page.route('/api/admin/shifts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FIXED_SHIFTS),
      });
    });
    await page.goto('/admin/shifts');
  });

  test('page loads with today heading', async ({ page }) => {
    await expect(page.getByText('Shift Log — Today')).toBeVisible();
    await expect(page.getByText('TELLER SHIFTS')).toBeVisible();
  });

  test('shows cashier1 shift from mock data', async ({ page }) => {
    await expect(page.getByText('Cashier One')).toBeVisible();
    // Status badge uses exact text to avoid matching "OPENING CASH"
    await expect(page.getByText('OPEN', { exact: true })).toBeVisible();
  });

  test('shift card shows all transaction stat labels', async ({ page }) => {
    await expect(page.getByText('TRANSACTIONS')).toBeVisible();
    await expect(page.getByText('TOTAL SOLD')).toBeVisible();
    await expect(page.getByText('TOTAL BOUGHT')).toBeVisible();
    await expect(page.getByText('TOTAL THAN')).toBeVisible();
    await expect(page.getByText('OPENING CASH')).toBeVisible();
  });

  test('open shift does not show variance fields', async ({ page }) => {
    // VARIANCE and EXPECTED CASH only show after shift is closed
    await expect(page.getByText('VARIANCE')).not.toBeVisible();
    await expect(page.getByText('EXPECTED CASH')).not.toBeVisible();
  });

  test('cashier username is shown', async ({ page }) => {
    await expect(page.getByText('@cashier1')).toBeVisible();
  });

  test('back button navigates to admin panel', async ({ page }) => {
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page).toHaveURL('/admin');
  });
});

// ── Supervisor access ─────────────────────────────────────────────────────────
test.describe('Supervisor — /admin/shifts access', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('supervisor can access shifts page', async ({ page }) => {
    await page.goto('/admin/shifts');
    await expect(page.getByText('Shift Log — Today')).toBeVisible();
  });
});
