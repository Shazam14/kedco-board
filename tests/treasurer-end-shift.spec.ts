/**
 * Treasurer end-shift summary — Playwright tests.
 *
 * When a supervisor (treasurer) closes their shift via /counter, the close
 * summary must show the treasurer-specific layout: overall bought/sold/diff,
 * dispatches/handoffs/opening, expected cash, and BALE PESO as a -₱X line.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const today = new Date().toISOString().split('T')[0];

const TREASURER_SHIFT = {
  id: 'shift-supervisor1-treasurer',
  date: today,
  cashier: 'supervisor1',
  cashier_name: 'Supervisor One',
  status: 'OPEN',
  opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  closed_at: null,
  opening_cash_php: 100_000,
  closing_cash_php: null,
  expected_cash_php: null,
  cash_variance: null,
  txn_count: 0,
  total_sold_php: 0,
  total_bought_php: 0,
  total_than: 0,
  total_replenishment_php: 200_000,
  replenishments: [
    { id: 'r1', amount_php: 200_000, source: 'SAFE', added_at: new Date().toISOString() },
  ],
  is_treasurer_shift: true,
  overall_total_bought_php: 500_000,
  overall_total_sold_php:   800_000,
  from_dispatches_php:      150_000,
  from_cashier_php:          75_000,
  bale_peso_php:            200_000,
};

test.describe('Treasurer end-shift — supervisor view', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/counter/shift', route => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TREASURER_SHIFT) });
      }
      return route.continue();
    });
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('/api/counter/setup-status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratesSet: true, positionsSet: true }) })
    );
    await page.goto('/counter');
  });

  test('end shift modal shows treasurer-specific summary rows', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();

    // Overall stats (from Transactions screen pattern)
    await expect(page.getByText('Total Bought (overall)')).toBeVisible();
    await expect(page.getByText('Total Sold (overall)')).toBeVisible();
    await expect(page.getByText('Difference (overall)')).toBeVisible();

    // Drawer flows — both legs of dispatch shown separately
    await expect(page.getByText('Dispatched Out')).toBeVisible();
    await expect(page.getByText('Remitted In (riders)')).toBeVisible();
    await expect(page.getByText('From Cashier')).toBeVisible();

    // Bale peso row appears as cash-in (vault → drawer); Vault Return shown only when > 0
    await expect(page.getByText('Bale Peso (vault → drawer)')).toBeVisible();
    await expect(page.getByText('+₱200,000.00')).toBeVisible();
  });

  test('cashier-style rows are NOT shown for treasurer', async ({ page }) => {
    await page.getByRole('button', { name: 'END SHIFT' }).click();

    // Cashier-only labels must not appear in the treasurer summary.
    // Exact match avoids colliding with the page-level "PETTY CASH / EXPENSES" heading.
    await expect(page.getByText('Total Sold (PHP)', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Total Bought (PHP)', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Petty Cash', { exact: true })).not.toBeVisible();
  });
});
