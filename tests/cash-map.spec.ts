/**
 * Cash Map card on /supervisor — live PHP location rollup.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

test.describe('Cash Map card on /supervisor', () => {
  test('renders rollup buckets + total', async ({ page }) => {
    await page.goto('/supervisor');
    await expect(page.getByText('PHP across all locations')).toBeVisible();
    await expect(page.getByTestId('cash-map-total')).toBeVisible();
    await expect(page.getByTestId('cash-map-drawer')).toBeVisible();
    await expect(page.getByTestId('cash-map-handoff')).toBeVisible();
    await expect(page.getByTestId('cash-map-in-field')).toBeVisible();
    await expect(page.getByTestId('cash-map-remit')).toBeVisible();
    await expect(page.getByTestId('cash-map-vault')).toBeVisible();
  });

  test('vault row surfaces in the detail list', async ({ page }) => {
    await page.goto('/supervisor');
    await expect(page.getByTestId('cash-map-rows')).toBeVisible();
    await expect(page.getByTestId('cash-map-rows').getByText('VAULT')).toBeVisible();
  });

  test('layout stays inside viewport on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await page.goto('/supervisor');
    await expect(page.getByText('PHP across all locations')).toBeVisible();
    const card = page.getByTestId('cash-map-total');
    await expect(card).toBeVisible();
    // No horizontal overflow on a 360px viewport.
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(360);
  });
});
