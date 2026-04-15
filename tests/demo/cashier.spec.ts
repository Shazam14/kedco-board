/**
 * Kedco FX — Cashier Demo Walkthrough
 *
 * Records the cashier's daily workflow:
 *   login → open shift → BUY transaction → SELL transaction → close shift
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/cashier.spec.ts
 *
 * Video: test-results/cashier-demo-chromium/video.webm
 */

import { test, expect } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));

// ─── the demo ─────────────────────────────────────────────────────────────────

test('Cashier walkthrough', async ({ page }) => {

  // ── Mock: cashier starts with NO open shift so we can show the open-shift flow
  let shiftOpened = false;
  const openedShift = {
    id: 'shift-demo-cashier2',
    date: new Date().toISOString().split('T')[0],
    cashier: 'cashiertest', cashier_name: 'Cashier (Demo)', status: 'OPEN',
    opened_at: new Date().toISOString(),
    opening_cash_php: 10000, closing_cash_php: null,
    expected_cash_php: null, cash_variance: null,
    txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
  };

  await page.route('/api/counter/shift', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      if (!shiftOpened) {
        await route.fulfill({ status: 404, contentType: 'application/json',
          body: JSON.stringify({ detail: 'No active shift.' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({
            ...openedShift,
            txn_count: 2, total_sold_php: 11200, total_bought_php: 27750, total_than: 0,
          }) });
      }
    } else if (method === 'POST') {
      const body = await route.request().postDataJSON();
      if (body.action === 'open') {
        shiftOpened = true;
        await route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify(openedShift) });
      } else if (body.action === 'close') {
        const expected = 10000 + 11200 - 27750;
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({
            ...openedShift, status: 'CLOSED',
            closed_at: new Date().toISOString(),
            txn_count: 2, total_sold_php: 11200, total_bought_php: 27750, total_than: 0,
            closing_cash_php: body.closing_cash_php,
            expected_cash_php: expected,
            cash_variance: body.closing_cash_php - expected,
          }) });
      } else {
        await route.continue();
      }
    } else {
      await route.continue();
    }
  });

  // ── 1. Login ─────────────────────────────────────────────────────────────────
  await page.goto('/login');
  await pause(800);
  await page.locator('input[autocomplete="username"]').click();
  await page.locator('input[autocomplete="username"]').type('cashiertest', { delay: 90 });
  await pause(400);
  await page.locator('input[autocomplete="current-password"]').click();
  await page.locator('input[autocomplete="current-password"]').type('Demo@2026!', { delay: 70 });
  await pause(500);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/counter');
  await pause(1200);

  // ── 2. Open shift ─────────────────────────────────────────────────────────────
  await expect(page.getByText('Open Your Shift')).toBeVisible();
  await pause(1000);
  await page.getByTestId('opening-cash-input').click();
  await page.getByTestId('opening-cash-input').type('10000', { delay: 100 });
  await pause(1200);
  await page.getByRole('button', { name: 'OPEN SHIFT' }).click();
  await pause(2000);

  // ── 3. Counter unlocked ───────────────────────────────────────────────────────
  await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
  await pause(1200);

  // ── 4. BUY transaction (customer sells USD to Kedco) ─────────────────────────
  await page.getByRole('button', { name: '↓ BUY' }).click();
  await pause(800);

  await page.getByRole('combobox').selectOption('USD');
  await pause(1000);

  await page.locator('input[placeholder="0.00"]').first().click();
  await page.locator('input[placeholder="0.00"]').first().type('500', { delay: 120 });
  await pause(1500);

  await page.getByPlaceholder('Name or reference').fill('Juan dela Cruz');
  await pause(800);

  await page.getByRole('button', { name: 'CONFIRM BUY TRANSACTION' }).click();
  await pause(2000);

  // ── 5. SELL transaction (customer buys USD from Kedco) ────────────────────────
  await page.getByRole('button', { name: '↑ SELL' }).click();
  await pause(800);

  await page.getByRole('combobox').selectOption('USD');
  await pause(1000);

  await page.locator('input[placeholder="0.00"]').first().click();
  await page.locator('input[placeholder="0.00"]').first().type('200', { delay: 120 });
  await pause(1500);

  await page.getByPlaceholder('Name or reference').fill('Maria Santos');
  await pause(800);

  await page.getByRole('button', { name: 'CONFIRM SELL TRANSACTION' }).click();
  await pause(2000);

  // ── 6. Close shift ────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'END SHIFT' }).click();
  await pause(1500);

  await expect(page.getByText('Close Your Shift')).toBeVisible();
  await pause(1800);

  await page.getByTestId('closing-cash-input').click();
  await page.getByTestId('closing-cash-input').type('8500', { delay: 100 });
  await pause(1200);

  await page.getByRole('button', { name: 'CLOSE SHIFT' }).click();
  await pause(2500);

  // ── 7. Shift closed summary ───────────────────────────────────────────────────
  await expect(page.getByText('SHIFT CLOSED')).toBeVisible();
  await pause(2500);
});
