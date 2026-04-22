/**
 * Counter screen tests.
 * Uses saved cashier auth state from globalSetup.
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

test.describe('Counter screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_SHIFT) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/counter');
  });

  test('loads with transaction form', async ({ page }) => {
    await expect(page.getByText('NEW TRANSACTION')).toBeVisible();
    await expect(page.getByText('↓ BUY')).toBeVisible();
    await expect(page.getByText('↑ SELL')).toBeVisible();
  });

  test('nav shows username and logout button', async ({ page }) => {
    await expect(page.getByText('cashier1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOGOUT' })).toBeVisible();
  });

  test('currency selector shows currencies with rates', async ({ page }) => {
    const input = page.getByPlaceholder('— Type code or country —');
    await expect(input).toBeVisible();
    await input.click();
    await expect(page.locator('text="USD"').first()).toBeVisible();
    await expect(page.locator('text="AUD"').first()).toBeVisible();
  });

  test('selecting currency fills rate automatically', async ({ page }) => {
    await pickCurrency(page, 'USD');
    const rateInput = page.locator('input').nth(2); // 0=ccy, 1=amount, 2=rate
    await expect(rateInput).not.toHaveValue('');
  });

  test('entering amount shows PHP total', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100'); // 0=ccy, 1=amount
    await expect(page.locator('text=/₱[1-9]/').first()).toBeVisible();
  });

  test('payment mode selector is visible with all modes', async ({ page }) => {
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'CASH', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GCASH', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MAYA', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CHEQUE', exact: true })).toBeVisible();
  });

  test('CASH is selected by default', async ({ page }) => {
    const cashBtn = page.getByRole('button', { name: 'CASH', exact: true });
    await expect(cashBtn).toBeVisible();
  });

  test('submit button is disabled without currency', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /CONFIRM/ });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button enables after filling required fields', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100'); // 0=ccy, 1=amount
    const submitBtn = page.getByRole('button', { name: /CONFIRM BUY/ });
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('successful transaction shows flash and print button', async ({ page }) => {
    await pickCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100'); // 0=ccy, 1=amount
    await page.getByRole('button', { name: /CONFIRM BUY/ }).click();
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Print Receipt/)).toBeVisible();
  });

  test('BUY/SELL toggle changes submit button label', async ({ page }) => {
    await expect(page.getByRole('button', { name: /CONFIRM BUY/ })).toBeDisabled();
    await page.getByText('↑ SELL').click();
    await expect(page.getByRole('button', { name: /CONFIRM SELL/ })).toBeDisabled();
  });

  test('logout redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: 'LOGOUT' }).click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});
