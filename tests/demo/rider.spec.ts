/**
 * Kedco FX — Rider Demo Walkthrough
 *
 * Records the rider's workflow:
 *   login → dispatch card → BUY transaction → SELL transaction → transaction log
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/rider.spec.ts
 *
 * Video: test-results/rider-demo-chromium/video.webm
 */

import { test, expect } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));

// ─── the demo ─────────────────────────────────────────────────────────────────

test('Rider walkthrough', async ({ page }) => {
  const dispatchId = 'dispatch-demo-rider01';

  // ── Mock: rider01 has an active dispatch with ₱50,000 ────────────────────────
  await page.route('/api/rider/dispatch', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        dispatch: {
          id:            dispatchId,
          cash_php:      50000,
          status:        'IN_FIELD',
          dispatch_time: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('/api/rider/borrow', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else {
      await route.continue();
    }
  });

  // ── 1. Login ─────────────────────────────────────────────────────────────────
  await page.goto('/login');
  await pause(800);
  await page.locator('input[autocomplete="username"]').click();
  await page.locator('input[autocomplete="username"]').type('ridertest', { delay: 90 });
  await pause(400);
  await page.locator('input[autocomplete="current-password"]').click();
  await page.locator('input[autocomplete="current-password"]').type('Demo@2026!', { delay: 70 });
  await pause(500);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/rider');
  await pause(1500);

  // ── 2. Dispatch card visible ──────────────────────────────────────────────────
  await expect(page.getByText('₱50,000.00').first()).toBeVisible();
  await pause(1800);

  // ── 3. BUY transaction (customer sells USD to rider) ─────────────────────────
  await page.getByRole('button', { name: 'BUY', exact: true }).click();
  await pause(800);

  // Rider uses a custom button picker — open it, then pick USD
  await page.getByRole('button', { name: 'Select currency…' }).click();
  await pause(600);
  await page.getByRole('button', { name: /USD/ }).click();
  await pause(1000);

  await page.locator('input[placeholder="0.00"]').first().click();
  await page.locator('input[placeholder="0.00"]').first().type('300', { delay: 120 });
  await pause(1500);

  await page.getByPlaceholder('Name or reference').fill('Pedro Reyes');
  await pause(800);

  await page.getByRole('button', { name: 'CONFIRM BUY' }).click();
  await pause(2000);

  // ── 4. SELL transaction (customer buys USD from rider) ────────────────────────
  await page.getByRole('button', { name: 'SELL', exact: true }).click();
  await pause(800);

  // currency (USD) stays selected from BUY — no picker action needed
  await pause(1000);

  await page.locator('input[placeholder="0.00"]').first().click();
  await page.locator('input[placeholder="0.00"]').first().type('150', { delay: 120 });
  await pause(1500);

  await page.getByPlaceholder('Name or reference').fill('Ana Reyes');
  await pause(800);

  await page.getByRole('button', { name: 'CONFIRM SELL' }).click();
  await pause(2000);

  // ── 5. Hold on balance card showing updated remaining ─────────────────────────
  await pause(2000);
});
