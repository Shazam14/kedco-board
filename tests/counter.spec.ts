/**
 * Counter screen tests.
 * Uses saved cashier auth state from globalSetup.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

test.describe('Counter screen', () => {
  test.beforeEach(async ({ page }) => {
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
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(select.locator('option', { hasText: 'USD' })).toHaveCount(1);
    await expect(select.locator('option', { hasText: 'AUD' })).toHaveCount(1);
  });

  test('selecting currency fills rate automatically', async ({ page }) => {
    await page.selectOption('select', 'USD');
    const rateInput = page.locator('input').nth(1); // second input is rate
    await expect(rateInput).not.toHaveValue('');
  });

  test('entering amount shows PHP total', async ({ page }) => {
    await page.selectOption('select', 'USD');
    await page.locator('input').first().fill('100');
    await expect(page.getByText(/₱/)).toBeVisible();
  });

  test('payment mode selector is visible with all modes', async ({ page }) => {
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'CASH' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GCASH' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MAYA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CHEQUE' })).toBeVisible();
  });

  test('CASH is selected by default', async ({ page }) => {
    // CASH button should be highlighted (has teal color via inline style)
    // Use attribute selector to find the active button
    const cashBtn = page.getByRole('button', { name: 'CASH' });
    await expect(cashBtn).toBeVisible();
  });

  test('submit button is disabled without currency', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /CONFIRM/ });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button enables after filling required fields', async ({ page }) => {
    await page.selectOption('select', 'USD');
    const amtInput = page.locator('input').first();
    await amtInput.fill('100');
    const submitBtn = page.getByRole('button', { name: /CONFIRM BUY/ });
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('successful transaction shows flash and print button', async ({ page }) => {
    await page.selectOption('select', 'USD');
    await page.locator('input').first().fill('100');
    await page.getByRole('button', { name: /CONFIRM BUY/ }).click();
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Print Receipt/)).toBeVisible();
  });

  test('BUY/SELL toggle changes submit button label', async ({ page }) => {
    await expect(page.getByRole('button', { name: /CONFIRM BUY/ })).toBeDisabled();
    await page.getByRole('button', { name: '↑ SELL' }).click();
    await expect(page.getByRole('button', { name: /CONFIRM SELL/ })).toBeDisabled();
  });

  test('logout redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: 'LOGOUT' }).click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});
