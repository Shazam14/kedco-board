/**
 * Safe / Vault tracking — treasurer-facing surfaces.
 *
 * The "safe" is a single shared PHP vault. Treasurers pull cash from it to
 * fund cashier replenishments. The /supervisor page surfaces the running
 * balance and lets a treasurer record manual deposits/withdrawals.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

test.describe('Safe card on /supervisor', () => {
  test('renders today net + running net + + MOVEMENT button', async ({ page }) => {
    await page.goto('/supervisor');
    await expect(page.getByText('SAFE / VAULT')).toBeVisible();
    await expect(page.getByTestId('safe-today-net')).toBeVisible();
    await expect(page.getByTestId('safe-running-net')).toBeVisible();
    await expect(page.getByTestId('safe-add-movement')).toBeVisible();
  });

  test('manual deposit appears in the list and bumps the net', async ({ page }) => {
    await page.goto('/supervisor');
    await page.getByTestId('safe-add-movement').click();

    await page.getByTestId('safe-direction-IN').click();
    await page.getByTestId('safe-amount').fill('250000');
    await page.getByTestId('safe-reason').selectOption('MANUAL_DEPOSIT');
    await page.getByTestId('safe-note').fill('e2e deposit');
    await page.getByTestId('safe-submit').click();

    await expect(page.getByTestId('safe-movements-list')).toContainText('MANUAL_DEPOSIT');
    await expect(page.getByTestId('safe-movements-list')).toContainText('+₱250,000.00');
    await expect(page.getByTestId('safe-today-net')).toContainText('+₱250,000.00');
  });

  test('withdrawal direction stores a negative amount', async ({ page }) => {
    await page.goto('/supervisor');
    await page.getByTestId('safe-add-movement').click();

    await page.getByTestId('safe-direction-OUT').click();
    await page.getByTestId('safe-amount').fill('40000');
    await page.getByTestId('safe-reason').selectOption('MANUAL_WITHDRAWAL');
    await page.getByTestId('safe-submit').click();

    await expect(page.getByTestId('safe-movements-list')).toContainText('−₱40,000.00');
  });
});
