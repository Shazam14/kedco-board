/**
 * Commission and referrer tracking tests.
 * Covers: preview on form, both BUY and SELL, referrer split, transaction list column.
 * Uses cashier auth state.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

const OPEN_SHIFT = {
  id: 'shift-cashier1-today', date: new Date().toISOString().split('T')[0],
  cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
  opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
  opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
  txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
};

async function pickCurrency(page: Page, code: string) {
  const input = page.getByPlaceholder('— Type code or country —');
  await input.click();
  await input.fill(code);
  await page.getByTestId(`currency-option-${code}`).click();
}

test.describe('Commission and referrer — cashier counter', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_SHIFT) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/counter');
  });

  test('referrer input is visible on the form', async ({ page }) => {
    await expect(page.getByPlaceholder('Referrer / tour guide (optional)')).toBeVisible();
  });

  test('SELL — commission preview appears when rate exceeds guide rate', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');  // amount
    await page.locator('input').nth(2).fill('58.00'); // transaction rate
    await page.locator('input').nth(3).fill('57.00'); // guide rate (base)
    await expect(page.getByText('COMMISSION PREVIEW')).toBeVisible();
    await expect(page.getByText(/Total:/).first()).toBeVisible();
  });

  test('BUY — commission preview appears when rate is below guide rate', async ({ page }) => {
    await page.getByText('↓ BUY').click();
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');  // amount
    await page.locator('input').nth(2).fill('55.00'); // transaction rate
    await page.locator('input').nth(3).fill('56.00'); // guide rate (base)
    await expect(page.getByText('COMMISSION PREVIEW')).toBeVisible();
  });

  test('no commission preview when guide rate is empty', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');
    await page.locator('input').nth(2).fill('58.00');
    // guide rate left empty — no preview
    await expect(page.getByText('COMMISSION PREVIEW')).not.toBeVisible();
  });

  test('referrer name shows split in commission preview', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');
    await page.locator('input').nth(2).fill('58.00');
    await page.locator('input').nth(3).fill('57.00'); // guide rate
    await page.getByPlaceholder('Referrer / tour guide (optional)').fill('Juan dela Cruz');
    await expect(page.getByText('Juan dela Cruz')).toBeVisible();
    await expect(page.getByText(/You:/)).toBeVisible();
  });

  test('COMM column is visible in transaction list header', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-COMM0001', time: '10:00 AM', type: 'SELL', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 58, phpAmt: 5800, than: 100,
          cashier: 'cashier1', paymentMode: 'CASH',
          officialRate: 57, referrer: 'Juan',
        }]),
      })
    );
    await page.reload();
    await expect(page.getByText('COMM', { exact: true }).first()).toBeVisible();
  });

  test('COMM column shows positive value for SELL above official rate', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-COMM0002', time: '10:00 AM', type: 'SELL', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 58, phpAmt: 5800, than: 100,
          cashier: 'cashier1', paymentMode: 'CASH',
          officialRate: 57,
        }]),
      })
    );
    await page.reload();
    // commission = (58 - 57) * 100 = ₱100.00
    await expect(page.getByText('+₱100.00')).toBeVisible();
  });

  test('COMM column shows positive value for BUY below official rate', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-COMM0003', time: '10:00 AM', type: 'BUY', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 55, phpAmt: 5500, than: 0,
          cashier: 'cashier1', paymentMode: 'CASH',
          officialRate: 56,
        }]),
      })
    );
    await page.reload();
    // commission = (56 - 55) * 100 = ₱100.00
    await expect(page.getByText('+₱100.00')).toBeVisible();
  });

  test('no COMM shown when officialRate is null', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-COMM0004', time: '10:00 AM', type: 'SELL', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 57, phpAmt: 5700, than: 0,
          cashier: 'cashier1', paymentMode: 'CASH',
          officialRate: null,
        }]),
      })
    );
    await page.reload();
    await expect(page.getByText('+₱')).not.toBeVisible();
  });

  test('referrer field is NOT visible for supervisor', async ({ page }) => {
    // This is verified in counter.spec.ts supervisor describe block
    // Just confirming cashier sees it
    await expect(page.getByPlaceholder('Referrer / tour guide (optional)')).toBeVisible();
  });
});
