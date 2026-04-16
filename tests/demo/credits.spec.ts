/**
 * Kedco FX — Special Credits Demo Walkthrough
 *
 * Records the admin creating and managing special customer credits:
 *   login → admin panel → special credits →
 *   create UPFRONT credit → create INSTALLMENT credit →
 *   mark payment received → cancel a credit
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/credits.spec.ts
 *
 * Video: test-results/credits-Special-Credits-demo-chromium/video.webm
 */

import { test } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));

test('Special Credits demo', async ({ page }) => {

  // ── 1. Login ─────────────────────────────────────────────────────────────────
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

  // ── 2. Navigate to Admin Panel ───────────────────────────────────────────────
  await page.goto('/admin');
  await pause(2000);

  // ── 3. Open Special Credits ──────────────────────────────────────────────────
  await page.getByText('Special Credits').click();
  await page.waitForURL('**/admin/credits');
  await pause(1500);

  // ── 4. Review existing credit ────────────────────────────────────────────────
  // Expand Sample Customer to show installments
  await page.getByText('Sample Customer').click();
  await pause(2000);
  // Collapse
  await page.getByText('Sample Customer').click();
  await pause(1000);

  // ── 5. Create UPFRONT credit (Option A) ──────────────────────────────────────
  await page.getByRole('button', { name: '+ New Credit' }).click();
  await pause(1000);

  await page.getByPlaceholder('e.g. Juan Dela Cruz').click();
  await page.getByPlaceholder('e.g. Juan Dela Cruz').type('Juan Dela Cruz', { delay: 80 });
  await pause(500);

  // Currency defaults to PHP
  await page.locator('input[placeholder="100000"]').click();
  await page.locator('input[placeholder="100000"]').type('100000', { delay: 60 });
  await pause(400);

  await page.locator('input[placeholder="5000"]').click();
  await page.locator('input[placeholder="5000"]').type('5000', { delay: 60 });
  await pause(600);

  // Disbursed date
  await page.locator('input[type="date"]').first().fill('2026-04-16');
  await pause(800);

  // Option A (UPFRONT) is default — system shows the summary
  await pause(1500);

  // Set payback due date
  await page.locator('input[type="date"]').last().fill('2026-05-16');
  await pause(800);

  // Optional notes
  await page.getByPlaceholder('Anything worth noting').click();
  await page.getByPlaceholder('Anything worth noting').type('VIP client, handle with care', { delay: 70 });
  await pause(800);

  // Save
  await page.getByRole('button', { name: 'Save Credit' }).click();
  await pause(2000);

  // ── 6. Create INSTALLMENT credit (Option B) ───────────────────────────────────
  await page.getByRole('button', { name: '+ New Credit' }).click();
  await pause(1000);

  await page.getByPlaceholder('e.g. Juan Dela Cruz').click();
  await page.getByPlaceholder('e.g. Juan Dela Cruz').type('Maria Santos', { delay: 80 });
  await pause(400);

  await page.locator('input[placeholder="100000"]').click();
  await page.locator('input[placeholder="100000"]').type('100000', { delay: 60 });
  await pause(300);

  await page.locator('input[placeholder="5000"]').click();
  await page.locator('input[placeholder="5000"]').type('5000', { delay: 60 });
  await pause(400);

  await page.locator('input[type="date"]').first().fill('2026-04-16');
  await pause(500);

  // Switch to INSTALLMENT (Option B)
  await page.getByRole('button', { name: 'Installment (Option B)' }).click();
  await pause(1500); // let summary compute and show

  // 2 payments (default) — set dates
  const datePickers = page.locator('input[type="date"]');
  await datePickers.nth(1).fill('2026-05-01');
  await pause(500);
  await datePickers.nth(2).fill('2026-05-16');
  await pause(800);

  await page.getByRole('button', { name: 'Save Credit' }).click();
  await pause(2000);

  // ── 7. Mark a payment as received ─────────────────────────────────────────────
  // Find Maria Santos and expand
  await page.getByText('Maria Santos').click();
  await pause(1500);

  // Mark first installment paid
  await page.getByRole('button', { name: 'Mark Paid' }).first().click();
  await pause(2000);

  // ── 8. Filter by COMPLETED ────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'COMPLETED' }).click();
  await pause(1500);
  await page.getByRole('button', { name: 'ACTIVE' }).click();
  await pause(1000);

  // ── 9. Done ───────────────────────────────────────────────────────────────────
  await page.goto('/admin');
  await pause(2000);
});
