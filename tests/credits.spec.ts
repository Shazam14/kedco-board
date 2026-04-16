/**
 * Special Credits — admin feature tests.
 * Covers:
 *   - Credits page loads and shows existing credits
 *   - Create UPFRONT credit (Option A)
 *   - Create INSTALLMENT credit (Option B) with multiple due dates
 *   - Mark an installment as paid
 *   - Cancel a credit
 *   - Admin-only access guard
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

test.describe('Special Credits page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/credits');
  });

  test('loads with correct heading and existing credit', async ({ page }) => {
    await expect(page.getByText('Special Customer Credits')).toBeVisible();
    await expect(page.getByText('Sample Customer')).toBeVisible();
    await expect(page.getByText('UPFRONT')).toBeVisible();
  });

  test('shows filter tabs', async ({ page }) => {
    for (const tab of ['ACTIVE', 'COMPLETED', 'CANCELLED', 'ALL']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('New Credit button opens form', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Credit' }).click();
    await expect(page.getByText('NEW CREDIT')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Juan Dela Cruz')).toBeVisible();
  });

  test('Cancel button closes form', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Credit' }).click();
    await expect(page.getByText('NEW CREDIT')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('NEW CREDIT')).not.toBeVisible();
  });

  test('expand/collapse credit row', async ({ page }) => {
    // Click the credit row to expand
    await page.getByText('Sample Customer').click();
    await expect(page.getByText('PAYMENT SCHEDULE')).toBeVisible();
    // Click again to collapse
    await page.getByText('Sample Customer').click();
    await expect(page.getByText('PAYMENT SCHEDULE')).not.toBeVisible();
  });
});

test.describe('Create UPFRONT credit (Option A)', () => {
  test('fills and submits the form', async ({ page }) => {
    await page.goto('/admin/credits');
    await page.getByRole('button', { name: '+ New Credit' }).click();

    // Fill in details
    await page.getByPlaceholder('e.g. Juan Dela Cruz').fill('Difficult Customer A');
    // Currency defaults to PHP, leave it
    await page.locator('input[placeholder="100000"]').fill('100000');
    await page.locator('input[placeholder="5000"]').fill('5000');
    // Disbursed date
    await page.locator('input[type="date"]').first().fill('2026-04-16');

    // Option A is default — verify the summary text appears
    await expect(page.getByText(/Ken gives:/)).toBeVisible();
    await expect(page.getByText(/95,000.00 PHP/)).toBeVisible();

    // Set payback due date
    await page.locator('input[type="date"]').last().fill('2026-05-16');

    // Submit
    await page.getByRole('button', { name: 'Save Credit' }).click();

    // New credit appears in the list
    await expect(page.getByText('Difficult Customer A')).toBeVisible();
  });
});

test.describe('Create INSTALLMENT credit (Option B)', () => {
  test('fills installment form with two payments', async ({ page }) => {
    await page.goto('/admin/credits');
    await page.getByRole('button', { name: '+ New Credit' }).click();

    await page.getByPlaceholder('e.g. Juan Dela Cruz').fill('Difficult Customer B');
    await page.locator('input[placeholder="100000"]').fill('100000');
    await page.locator('input[placeholder="5000"]').fill('5000');
    await page.locator('input[type="date"]').first().fill('2026-04-16');

    // Switch to INSTALLMENT
    await page.getByRole('button', { name: 'Installment (Option B)' }).click();

    // Verify total due summary
    await expect(page.getByText(/105,000.00 PHP/)).toBeVisible();
    await expect(page.getByText(/52,500.00 PHP/)).toBeVisible();

    // 2 payments (default) — fill both due dates
    const datePickers = page.locator('input[type="date"]');
    await datePickers.nth(1).fill('2026-05-01');
    await datePickers.nth(2).fill('2026-05-16');

    await page.getByRole('button', { name: 'Save Credit' }).click();

    await expect(page.getByText('Difficult Customer B')).toBeVisible();
    await expect(page.getByText('INSTALLMENT').first()).toBeVisible();
  });
});

test.describe('Credit actions', () => {
  test('mark installment as paid', async ({ page }) => {
    await page.goto('/admin/credits');

    // Expand the existing credit
    await page.getByText('Sample Customer').click();
    await expect(page.getByText('PAYMENT SCHEDULE')).toBeVisible();

    // Click Mark Paid
    await page.getByRole('button', { name: 'Mark Paid' }).click();

    // Paid confirmation appears
    await expect(page.getByText(/Paid .+ by admin/)).toBeVisible();
  });

  test('cancel a credit shows confirmation and updates status', async ({ page }) => {
    await page.goto('/admin/credits');

    // Create a fresh credit to cancel
    await page.getByRole('button', { name: '+ New Credit' }).click();
    await page.getByPlaceholder('e.g. Juan Dela Cruz').fill('Customer To Cancel');
    await page.locator('input[placeholder="100000"]').fill('10000');
    await page.locator('input[placeholder="5000"]').fill('500');
    await page.locator('input[type="date"]').first().fill('2026-04-16');
    await page.locator('input[type="date"]').last().fill('2026-05-01');
    await page.getByRole('button', { name: 'Save Credit' }).click();
    await expect(page.getByText('Customer To Cancel')).toBeVisible();

    // Expand and cancel
    await page.getByText('Customer To Cancel').click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel Credit' }).click();

    // Status badge changes to CANCELLED
    await expect(page.locator('span', { hasText: 'CANCELLED' }).first()).toBeVisible();
  });
});

test.describe('Access control', () => {
  test('cashier cannot access /admin/credits', async ({ page, context }) => {
    // Use cashier auth state
    await context.clearCookies();
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'cashier1');
    await page.fill('input[autocomplete="current-password"]', 'cashier1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/counter');

    await page.goto('/admin/credits');
    // Should be redirected away (not stay on credits page)
    await expect(page).not.toHaveURL(/\/admin\/credits/);
  });
});
