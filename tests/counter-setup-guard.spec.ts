/**
 * Regression guard for the cashier daily-setup lockout.
 *
 * Counter shell must not let the cashier touch the transaction form until
 * the day is set up — both today's rates AND today's opening positions.
 * Without this guard, a cashier can write a transaction against a stale
 * carry-in or zero rate and silently corrupt THAN/expected-cash math.
 *
 * Flow:
 *   • SSR computes `ratesSet` from currencies (page.tsx)
 *   • Shell fetches /api/counter/setup-status for `positionsSet`
 *   • If !ratesSet OR positionsSet === false → lockout
 *   • Lockout is the same screen for both failure modes
 *
 * Note: ratesSet is server-side — we can't easily flip it from a Playwright
 * test. We exercise the positionsSet=false path, which fires the same guard.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

const OPEN_SHIFT = {
  id: 'shift-cashier1-today', date: new Date().toISOString().split('T')[0],
  cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
  opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
  opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
  txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
};

test.describe('Counter daily-setup guard', () => {
  test('blocks the form when positions are not set', async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_SHIFT) })
    );
    await page.route('/api/counter/setup-status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratesSet: true, positionsSet: false }) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.goto('/counter');

    // Lockout card is up
    await expect(page.getByText('Not ready yet')).toBeVisible();
    await expect(page.getByText('Admin needs to complete daily setup before you can start.')).toBeVisible();

    // Positions check is the failing one — shows the hint
    await expect(page.getByText('Opening positions set')).toBeVisible();
    await expect(page.getByText('Admin needs to set carry-in stock for today.')).toBeVisible();

    // Transaction form must NOT be reachable
    await expect(page.getByText('NEW TRANSACTION')).toHaveCount(0);
    await expect(page.getByText('↓ BUY')).toHaveCount(0);
    await expect(page.getByText('↑ SELL')).toHaveCount(0);

    // Lockout has a refresh button so admin can fix → cashier retries
    await expect(page.getByRole('button', { name: 'REFRESH' })).toBeVisible();
  });

  test('lets the form through when both rates and positions are set', async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_SHIFT) })
    );
    await page.route('/api/counter/setup-status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratesSet: true, positionsSet: true }) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.goto('/counter');

    await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
    await expect(page.getByText('Not ready yet')).toHaveCount(0);
  });
});
