/**
 * Treasurer (supervisor) hub navigation + Pending Payments shell.
 * Verifies the hub renders the expected cards and that /supervisor/payables
 * surfaces pending slices from the daily report and confirms cleanly.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

test.describe('Treasurer hub', () => {
  test('renders the seven cards', async ({ page }) => {
    await page.goto('/supervisor');
    await expect(page.getByText('What do you need to do?')).toBeVisible();
    for (const title of [
      'Counter',
      'Opening Positions',
      'Daily Report',
      'Transactions',
      'Rider Dispatch',
      'Cashier Floats',
      'Pending Payments',
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    }
  });

  test('Pending Payments card navigates to /supervisor/payables', async ({ page }) => {
    await page.goto('/supervisor');
    await page.getByRole('link', { name: /Pending Payments/ }).click();
    await page.waitForURL('**/supervisor/payables**');
    await expect(page.getByText('Treasurer · Pending Payments')).toBeVisible();
  });
});

test.describe('Pending Payments shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/supervisor/payables');
    await page.waitForLoadState('networkidle');
  });

  test('lists the pending GCASH slice from the daily report', async ({ page }) => {
    // Mock report has TXN-003 SELL USD with CASH 7600 RECEIVED + GCASH 3600 PENDING.
    await expect(page.getByText('TXN-003', { exact: false })).toBeVisible();
    await expect(page.getByText(/GCASH ₱3,600\.00/)).toBeVisible();
    await expect(page.getByText(/1 pending/)).toBeVisible();
  });

  test('confirm button removes the pending row', async ({ page }) => {
    await expect(page.getByText('TXN-003', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /CONFIRM/ }).click();
    await expect(page.getByText(/No pending payments for this date/)).toBeVisible();
  });

  test('back-to-hub link returns to /supervisor', async ({ page }) => {
    await page.getByRole('link', { name: /HUB/ }).click();
    await page.waitForURL('**/supervisor');
    await expect(page.getByText('What do you need to do?')).toBeVisible();
  });
});
