/**
 * Kedco FX — Admin Daily Workflow
 *
 * A full walkthrough of every tool on the Admin Panel — interactive:
 *
 *   login → "What do you need to do?"
 *   → Set Today's Rates        (USD buy + sell)
 *   → Counter                  (BUY + SELL)
 *   → Opening Positions        (enter USD qty + rate, save)
 *   → Rider Dispatch           (dispatch ridertest with ₱50,000)
 *   → Manage Users             (edit cashier1's name)
 *   → Manage Banks             (add Security Bank)
 *   → End of Day               (confirm + close day)
 *   → Audit Trail              (browse)
 *   → Daily Report             (browse with real data)
 *   → Dashboard                (check capital)
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/admin-daily.spec.ts
 *
 * Video: test-results/admin-daily-Admin-daily-workflow-chromium/video.webm
 */

import { test, expect } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));
const todayStr = new Date().toISOString().split('T')[0];

test('Admin daily workflow', async ({ page }) => {

  // ── Browser-side mocks ────────────────────────────────────────────────────
  // Counter shift — admin has an open shift
  await page.route('/api/counter/shift', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 'shift-admin-demo', date: todayStr,
          cashier: 'admintest', cashier_name: 'Admin (Demo)',
          status: 'OPEN', opened_at: new Date().toISOString(),
          opening_cash_php: 50000,
          closing_cash_php: null, expected_cash_php: null, cash_variance: null,
          txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Users — client component fetches this
  await page.route('/api/admin/users', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { username:'admin',    full_name:'Admin User',  role:'admin',   branch:null,          is_active:true, is_demo:false },
          { username:'cashier1', full_name:'Cashier One', role:'cashier', branch:'Main Branch', is_active:true, is_demo:false },
          { username:'rider01',  full_name:'Rider One',   role:'rider',   branch:null,          is_active:true, is_demo:false },
        ]),
      });
    } else {
      await route.continue();
    }
  });

  // User PATCH (edit name / branch)
  await page.route('/api/admin/users/**', async route => {
    if (route.request().method() === 'PATCH') {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          username: 'cashier1',
          full_name: body.full_name ?? 'Cashier One',
          role: 'cashier', branch: body.branch ?? 'Main Branch',
          is_active: true, is_demo: false,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Positions save
  await page.route('/api/admin/positions', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ message: 'Positions saved', saved: 1 }),
      });
    } else {
      await route.continue();
    }
  });

  // Rider dispatch
  await page.route('/api/admin/rider/dispatches', async route => {
    if (route.request().method() === 'POST') {
      const data = await route.request().postDataJSON();
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          id: 'dispatch-demo-001',
          rider_username: data.rider_username,
          rider_name: 'Rider (Demo)',
          status: 'IN_FIELD',
          dispatch_time: '09:00 AM',
          return_time: null,
          cash_php: data.cash_php,
          notes: data.notes ?? null,
          dispatched_by: 'admintest',
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Banks POST (add new)
  await page.route('/api/admin/banks', async route => {
    if (route.request().method() === 'POST') {
      const data = await route.request().postDataJSON();
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 4, name: data.name, code: data.code, is_active: true, sort_order: 4 }),
      });
    } else {
      await route.continue();
    }
  });

  // EOD close
  await page.route('/api/admin/eod', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        closed_date:     todayStr,
        currencies_rolled: 5,
        tomorrow_ready:  new Date(Date.now() + 86400000).toISOString().split('T')[0],
        total_than:      1500,
        total_bought:    55000,
        total_sold:      45000,
        closing_capital: 980000,
        closed_by:       'admintest',
        message:         'End of day complete. Stock rolled forward.',
      }),
    });
  });

  // ── 1. Login ─────────────────────────────────────────────────────────────
  await page.goto('/login');
  await pause(800);
  await page.locator('input[autocomplete="username"]').click();
  await page.locator('input[autocomplete="username"]').type('admintest', { delay: 90 });
  await pause(400);
  await page.locator('input[autocomplete="current-password"]').click();
  await page.locator('input[autocomplete="current-password"]').type('Demo@2026!', { delay: 70 });
  await pause(500);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');
  await pause(1500);

  // ── 2. Admin panel — "What do you need to do?" ───────────────────────────
  await page.goto('/admin');
  await pause(3000);

  // ── 3. Set today's rates ─────────────────────────────────────────────────
  await page.getByRole('link', { name: /set today.s rates/i }).click();
  await page.waitForURL('**/admin/rates');
  await pause(1500);

  const usdBuy  = page.locator('input[inputmode="decimal"]').nth(0);
  const usdSell = page.locator('input[inputmode="decimal"]').nth(1);

  await usdBuy.click();
  await usdBuy.press('Control+a');
  await usdBuy.type('55.50', { delay: 100 });
  await pause(800);

  await usdSell.click();
  await usdSell.press('Control+a');
  await usdSell.type('56.00', { delay: 100 });
  await pause(1200);

  await page.getByRole('button', { name: /save.*rate/i }).click();
  await pause(2000);

  // ── 4. Counter — BUY + SELL ───────────────────────────────────────────────
  await page.goto('/admin');
  await pause(1800);
  await page.getByRole('link', { name: /counter/i }).click();
  await page.waitForURL('**/counter');
  await pause(1500);

  await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
  await pause(1000);

  await page.getByRole('button', { name: '↓ BUY' }).click();
  await pause(800);
  await page.getByRole('combobox').selectOption('USD');
  await pause(1000);
  await page.locator('input[placeholder="0.00"]').first().type('500', { delay: 130 });
  await pause(1200);
  await page.getByPlaceholder('Name or reference').fill('Walk-in Customer');
  await pause(800);
  await page.getByRole('button', { name: 'CONFIRM BUY TRANSACTION' }).click();
  await pause(2000);

  await page.getByRole('button', { name: '↑ SELL' }).click();
  await pause(800);
  await page.getByRole('combobox').selectOption('USD');
  await pause(1000);
  await page.locator('input[placeholder="0.00"]').first().type('200', { delay: 130 });
  await pause(1200);
  await page.getByPlaceholder('Name or reference').fill('Walk-in Customer 2');
  await pause(800);
  await page.getByRole('button', { name: 'CONFIRM SELL TRANSACTION' }).click();
  await pause(2000);

  // ── 5. Opening Positions — enter USD qty + rate ───────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /opening positions/i }).click();
  await page.waitForURL('**/admin/positions');
  await pause(1800);

  // USD qty (first numeric input) and rate (first number input)
  await page.locator('input[inputmode="numeric"]').first().click();
  await page.locator('input[inputmode="numeric"]').first().type('5000', { delay: 100 });
  await pause(800);

  await page.locator('input[type="number"]').first().click();
  await page.locator('input[type="number"]').first().type('55.00', { delay: 100 });
  await pause(1200);

  await page.getByRole('button', { name: /save.*position/i }).click();
  await pause(2000);

  // ── 6. Rider Dispatch — dispatch ridertest ────────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /rider dispatch/i }).click();
  await page.waitForURL('**/admin/riders');
  await pause(1800);

  await page.getByRole('combobox').selectOption('ridertest');
  await pause(800);
  await page.getByPlaceholder(/starting php/i).click();
  await page.getByPlaceholder(/starting php/i).type('50000', { delay: 100 });
  await pause(1000);
  await page.getByRole('button', { name: /dispatch/i }).click();
  await pause(2000);

  // ── 7. Manage Users — edit cashier1's name ────────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /manage users/i }).click();
  await page.waitForURL('**/admin/users');
  await pause(2000);

  // cashier1 is nth(1) EDIT button: admin(0), cashier1(1), rider01(2)
  await page.getByRole('button', { name: 'EDIT' }).nth(1).click();
  await pause(800);

  await page.getByPlaceholder('Display name').fill('Cashier One — SM Seaside');
  await pause(1200);

  await page.getByRole('button', { name: 'SAVE' }).click();
  await pause(2000);

  // ── 8. Manage Banks — add Security Bank ──────────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /manage banks/i }).click();
  await page.waitForURL('**/admin/banks');
  await pause(1800);

  await page.getByPlaceholder('e.g. Bank of Commerce').fill('Security Bank');
  await pause(600);
  await page.getByPlaceholder('e.g. BOC').fill('SBC');
  await pause(800);
  await page.getByRole('button', { name: '+ ADD' }).click();
  await pause(2000);

  // ── 9. End of Day — confirm + close ──────────────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /end of day/i }).click();
  await page.waitForURL('**/admin/eod');
  await pause(2000);

  await page.locator('input[type="checkbox"]').check();
  await pause(1200);

  await page.getByRole('button', { name: /close.*day/i }).click();
  await pause(3000);

  await expect(page.getByText('Day Closed Successfully')).toBeVisible();
  await pause(2500);

  // ── 10. Audit Trail — browse ──────────────────────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /audit trail/i }).click();
  await page.waitForURL('**/admin/audit');
  await pause(3000);

  // ── 11. Daily Report — browse with real data ──────────────────────────────
  await page.goto('/admin');
  await pause(1500);
  await page.getByRole('link', { name: /daily report/i }).click();
  await page.waitForURL('**/admin/report');
  await pause(3500);

  // ── 12. Dashboard — see capital ───────────────────────────────────────────
  await page.goto('/dashboard');
  await pause(3000);
});
