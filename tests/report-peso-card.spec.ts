/**
 * Daily Report — Peso card (treasurer drawer bookends).
 *
 * Card sits above the SAFE / Vault Movements block on /admin/report.
 * PHP Capital chip stays admin-only — treasurer role hits the same page but
 * the chip is gated server-side on role==='admin'.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Peso card — admin', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test('renders OPENING + CLOSING peso, sits above SAFE block', async ({ page }) => {
    await page.goto('/admin/report');

    const peso = page.getByTestId('report-peso');
    await expect(peso).toBeVisible();
    await expect(peso).toContainText('OPENING PESO');
    await expect(peso).toContainText('CLOSING PESO');
    await expect(page.getByTestId('peso-opening')).toContainText('₱2,500,000.00');
    await expect(page.getByTestId('peso-closing')).toContainText('₱2,750,000.00');

    const safe = page.getByTestId('report-safe');
    if (await safe.count()) {
      const order = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="report-peso"]');
        const s = document.querySelector('[data-testid="report-safe"]');
        if (!p || !s) return null;
        return (p.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'before' : 'after';
      });
      expect(order).toBe('before');
    }
  });
});

test.describe('PHP Capital chip — treasurer cannot see it', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('chip is hidden for supervisor role', async ({ page }) => {
    await page.goto('/admin/report');
    await expect(page.getByTestId('php-capital-chip')).toHaveCount(0);
  });
});
