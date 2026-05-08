/**
 * BSP Quarterly MC/FX Volume report — admin-only screen for Circular 1222 filing.
 * Verifies: admin sees the headline + breakdowns; treasurer is bounced (admin-only,
 * unlike rates/positions which are delegated). Numbers come from mock-api.mjs.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('BSP volume — admin', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test('renders headline + breakdown tables', async ({ page }) => {
    await page.goto('/admin/bsp/volume?year=2026&quarter=1');
    await page.waitForLoadState('networkidle');

    // Header chip + headline
    await expect(page.getByText('BSP CIRCULAR 1222 · QUARTERLY MC/FX VOLUME')).toBeVisible();
    await expect(page.getByText(/Q1 2026 · ₱1,000,000\.00/)).toBeVisible();

    // Headline cards
    await expect(page.getByText('TOTAL VOLUME', { exact: true })).toBeVisible();
    await expect(page.getByText('BUY', { exact: true })).toBeVisible();
    await expect(page.getByText('SELL', { exact: true })).toBeVisible();

    // Type-F panel
    await expect(page.getByText('TYPE F THRESHOLD CHECK (₱50M / MONTH)')).toBeVisible();
    await expect(page.getByText('CURRENTLY TYPE F')).toBeVisible();

    // Breakdown sections
    await expect(page.getByText('BY CURRENCY', { exact: true })).toBeVisible();
    await expect(page.getByText('BY BRANCH', { exact: true })).toBeVisible();
    await expect(page.getByText('BY MONTH (within quarter)', { exact: true })).toBeVisible();

    // Currency rows from mock
    await expect(page.getByRole('cell', { name: 'USD', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EUR', exact: true })).toBeVisible();

    // Branch rows
    await expect(page.getByRole('cell', { name: 'MAIN', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'CTS',  exact: true })).toBeVisible();

    // Print button is present
    await expect(page.getByRole('button', { name: /PRINT FILING SHEET/ })).toBeVisible();
  });

  test('quarter picker submits to ?year=&quarter= and re-renders', async ({ page }) => {
    await page.goto('/admin/bsp/volume?year=2026&quarter=1');
    await page.waitForLoadState('networkidle');

    await page.locator('select[name="quarter"]').selectOption('2');
    await page.getByRole('button', { name: 'VIEW' }).click();

    await page.waitForURL(/quarter=2/);
    await expect(page).toHaveURL(/quarter=2/);
  });

  test('admin home shows Compliance section with BSP card', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('COMPLIANCE', { exact: true })).toBeVisible();
    const bspCard = page.getByRole('link', { name: /BSP Quarterly Volume/ });
    await expect(bspCard).toBeVisible();
    await expect(bspCard).toHaveAttribute('href', '/admin/bsp/volume');
  });
});

test.describe('BSP volume — treasurer cannot access', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('treasurer is redirected away from /admin/bsp/volume', async ({ page }) => {
    await page.goto('/admin/bsp/volume');
    // Server redirects to '/' (treasurer is not admin)
    await page.waitForURL(url => !/\/admin\/bsp/.test(url.pathname));
    expect(page.url()).not.toContain('/admin/bsp/volume');
  });
});
