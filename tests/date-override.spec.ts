/**
 * Date Override feature tests.
 * Admin can set a date override so the system runs as a different date —
 * useful for backdating and multi-day UAT walkthroughs.
 *
 * Uses admin auth state. Resets mock-api state before each test.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

const PAST_DATE = '2026-04-06';
const TODAY = new Date().toISOString().split('T')[0];

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:9999/api/v1/test/reset');
});

async function fillDate(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never, date: string) {
  const input = page.locator('input[type="date"]');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(date);
}

test.describe('Date Override Panel — admin page', () => {
  test('panel is visible on admin page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Date Override')).toBeVisible();
  });

  test('no ACTIVE badge when no override is set', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('ACTIVE')).not.toBeVisible();
  });

  test('shows correct label when no override', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/System is using the real date/i)).toBeVisible();
  });

  test('setting a past date shows ACTIVE badge and confirmation message', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();
    await expect(page.getByText('ACTIVE')).toBeVisible();
    await expect(page.getByText(/Date override active/i)).toBeVisible();
  });

  test('setting a past date updates the description text', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();
    await expect(page.getByText(new RegExp(`running as ${PAST_DATE}`, 'i'))).toBeVisible();
  });

  test('Clear button appears after setting a date', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();
    await expect(page.getByRole('button', { name: /Clear/i })).toBeVisible();
  });

  test('clearing removes ACTIVE badge and description reverts', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();
    await expect(page.getByText('ACTIVE')).toBeVisible();

    await page.getByRole('button', { name: /Clear/i }).click();
    await expect(page.getByText('ACTIVE')).not.toBeVisible();
    await expect(page.getByText(/System is using the real date/i)).toBeVisible();
  });

  test('setting today\'s date does not show ACTIVE badge', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, TODAY);
    await page.getByRole('button', { name: 'Set Date' }).click();
    // isOverrideActive is false when date === today
    await expect(page.getByText('ACTIVE')).not.toBeVisible();
  });
});

test.describe('Date Override Banner', () => {
  test('no banner when no override is active', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).not.toBeVisible();
  });

  test('banner appears after setting a past date', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();

    // Banner polls every 30s but also fires on mount — navigate away and back to trigger fresh mount
    await page.goto('/dashboard');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(new RegExp(PAST_DATE))).toBeVisible();
  });

  test('banner is not shown when date is set to today', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, TODAY);
    await page.getByRole('button', { name: 'Set Date' }).click();

    await page.goto('/dashboard');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).not.toBeVisible();
  });

  test('banner disappears after clearing the override', async ({ page }) => {
    // Set a past date first
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();

    // Confirm banner shows on dashboard
    await page.goto('/dashboard');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).toBeVisible({ timeout: 10_000 });

    // Go back to admin, clear it
    await page.goto('/admin');
    await page.getByRole('button', { name: /Clear/i }).click();

    // Banner should be gone
    await page.goto('/dashboard');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).not.toBeVisible();
  });

  test('banner links back to admin panel', async ({ page }) => {
    await page.goto('/admin');
    await fillDate(page, PAST_DATE);
    await page.getByRole('button', { name: 'Set Date' }).click();

    await page.goto('/dashboard');
    await expect(page.getByText(/DATE OVERRIDE ACTIVE/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /Change in Admin/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });
});
