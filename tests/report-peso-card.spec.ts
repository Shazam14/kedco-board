/**
 * Daily Report — Peso boxes + flow breakdown.
 *
 * OPENING PESO + CLOSING PESO sit inline with the existing summary boxes.
 * A peso flow row mirrors the stock flow showing the full treasurer formula:
 * OPEN + SOLD − BOUGHT + BALE ± VAULT + CHEQUES − EXPENSES = CLOSE.
 * VAULT row sign flips drawer-aware: deposit → '−', withdrawal → '+'.
 *
 * PHP Capital chip stays admin-only.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Peso boxes + flow — admin', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test('OPENING/CLOSING PESO render as summary boxes', async ({ page }) => {
    await page.goto('/admin/report');
    await expect(page.getByTestId('peso-opening')).toContainText('₱2,500,000.00');
    await expect(page.getByTestId('peso-closing')).toContainText('₱2,750,000.00');
  });

  test('peso flow shows full breakdown formula', async ({ page }) => {
    await page.goto('/admin/report');
    const flow = page.getByTestId('peso-flow');
    await expect(flow).toBeVisible();
    await expect(flow).toContainText('OPENING PESO');
    await expect(flow).toContainText('SOLD');
    await expect(flow).toContainText('BOUGHT');
    await expect(flow).toContainText('BALE');
    await expect(flow).toContainText('VAULT');
    await expect(flow).toContainText('CHEQUES');
    await expect(flow).toContainText('EXPENSES');
    await expect(flow).toContainText('CLOSING PESO');
  });
});

test.describe('Peso boxes + flow — treasurer', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('treasurer sees the same peso boxes + flow', async ({ page }) => {
    await page.goto('/admin/report');
    await expect(page.getByTestId('peso-opening')).toContainText('₱2,500,000.00');
    await expect(page.getByTestId('peso-closing')).toContainText('₱2,750,000.00');
    await expect(page.getByTestId('peso-flow')).toBeVisible();
  });

  test('PHP Capital chip is hidden for treasurer', async ({ page }) => {
    await page.goto('/admin/report');
    await expect(page.getByTestId('php-capital-chip')).toHaveCount(0);
  });
});
