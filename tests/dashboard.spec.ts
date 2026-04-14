/**
 * Dashboard tests.
 * Uses saved admin auth state from globalSetup.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('loads with all tabs', async ({ page }) => {
    for (const tab of ['Dashboard', 'Positions', 'Transactions', 'Rider', 'Rate Board', 'Tracker']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('shows capital summary cards', async ({ page }) => {
    await expect(page.getByText('TOTAL CAPITAL POSITION')).toBeVisible();
    await expect(page.getByText('PHP CASH')).toBeVisible();
    await expect(page.getByText('FX STOCK VALUE')).toBeVisible(); // actual label (not 'TOTAL STOCK')
  });

  test('Rider tab — shows dispatch form', async ({ page }) => {
    await page.getByRole('button', { name: 'Rider' }).click();
    await expect(page.getByText('Dispatch a Rider')).toBeVisible();
    await expect(page.getByText('STARTING CASH (PHP)')).toBeVisible();
    // RIDER label in the form — use a label locator to avoid matching other text
    await expect(page.locator('label', { hasText: 'RIDER' })).toBeVisible();
  });

  test('Rider tab — shows no riders in field initially', async ({ page }) => {
    await page.getByRole('button', { name: 'Rider' }).click();
    await expect(page.getByText('No riders currently in the field')).toBeVisible();
  });

  test('Rider tab — dispatch form lists available riders', async ({ page }) => {
    await page.getByRole('button', { name: 'Rider' }).click();
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(select.locator('option', { hasText: /rider01/i })).toHaveCount(1);
  });

  test('Rider tab — dispatch button disabled until rider and cash selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Rider' }).click();
    const dispatchBtn = page.getByRole('button', { name: 'DISPATCH' });
    await expect(dispatchBtn).toBeDisabled();
  });

  test('Positions tab loads', async ({ page }) => {
    await page.getByRole('button', { name: 'Positions' }).click();
    // USD appears in positions table — use first() since it may appear in the ticker too
    await expect(page.getByText('USD').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Transactions tab loads', async ({ page }) => {
    await page.getByRole('button', { name: 'Transactions' }).click();
    // The source filter has ALL / COUNTER / RIDER buttons
    await expect(page.getByRole('button', { name: 'ALL', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('Rate Board tab loads', async ({ page }) => {
    await page.getByRole('button', { name: 'Rate Board' }).click();
    // 'Kedco FX' appears in nav + rate board — use first()
    await expect(page.getByText(/Kedco FX/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('logout redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: 'LOGOUT' }).click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});

test.describe('Dashboard — supervisor access', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('supervisor can access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('TOTAL CAPITAL POSITION')).toBeVisible();
  });
});
