/**
 * Kedco FX — Admin Demo Walkthrough
 *
 * Records the admin's daily workflow:
 *   login → dashboard (tabs) → admin panel → rates → positions →
 *   shift log → riders → users → EOD → audit log → daily report → logout
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/admin.spec.ts
 *
 * Video: test-results/admin-Admin-walkthrough-chromium/video.webm
 */

import { test } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));

// ─── the demo ─────────────────────────────────────────────────────────────────

test('Admin walkthrough', async ({ page }) => {

  // ── 1. Landing page ─────────────────────────────────────────────────────────
  await page.goto('/');
  await pause(1500);

  // ── 2. Login ────────────────────────────────────────────────────────────────
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

  // ── 3. Dashboard — browse tabs ───────────────────────────────────────────────
  await pause(1200);

  await page.getByRole('button', { name: 'Positions' }).click();
  await pause(1500);

  await page.getByRole('button', { name: 'Transactions' }).click();
  await pause(1500);

  await page.getByRole('button', { name: 'Rider', exact: true }).click();
  await pause(1500);

  await page.getByRole('button', { name: 'Rate Board' }).click();
  await pause(1500);

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await pause(1200);

  // ── 4. Admin panel home ──────────────────────────────────────────────────────
  await page.goto('/admin');
  await pause(2000);

  // ── 5. Set rates ─────────────────────────────────────────────────────────────
  await page.goto('/admin/rates');
  await pause(2000);

  // ── 6. Stock positions ───────────────────────────────────────────────────────
  await page.goto('/admin/positions');
  await pause(2000);

  // ── 7. Shift log ─────────────────────────────────────────────────────────────
  await page.goto('/admin/shifts');
  await pause(2000);

  // ── 8. Rider dispatch management ────────────────────────────────────────────
  await page.goto('/admin/riders');
  await pause(2000);

  // ── 9. User management (shows DEMO badge on demo accounts) ──────────────────
  await page.goto('/admin/users');
  await pause(2000);

  // ── 10. End of day ───────────────────────────────────────────────────────────
  await page.goto('/admin/eod');
  await pause(2000);

  // ── 11. Audit log ────────────────────────────────────────────────────────────
  await page.goto('/admin/audit');
  await pause(2000);

  // ── 12. Daily report ─────────────────────────────────────────────────────────
  await page.goto('/admin/report');
  await pause(2500);

  // ── 13. Logout ────────────────────────────────────────────────────────────────
  await page.goto('/dashboard');
  await pause(800);
  await page.getByRole('button', { name: 'LOGOUT' }).first().click();
  await pause(1500);
});
