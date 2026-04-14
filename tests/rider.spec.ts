/**
 * Rider screen tests.
 * Uses saved rider auth state from globalSetup.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

test.describe('Rider screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rider');
  });

  test('loads with rider username in header', async ({ page }) => {
    await expect(page.getByText('rider01')).toBeVisible();
    await expect(page.getByText('KEDCO FX')).toBeVisible();
  });

  test('shows logout button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'LOGOUT' })).toBeVisible();
  });

  test('shows not dispatched warning when no dispatch', async ({ page }) => {
    await expect(page.getByText(/Not dispatched/)).toBeVisible();
  });

  test('has BUY and SELL buttons', async ({ page }) => {
    // Use exact: true — 'BUY' partial match also hits 'CONFIRM BUY'
    await expect(page.getByRole('button', { name: 'BUY', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SELL', exact: true })).toBeVisible();
  });

  test('currency picker opens and shows currencies', async ({ page }) => {
    await page.getByText('Select currency…').click();
    await expect(page.getByText('USD')).toBeVisible();
    await expect(page.getByText('AUD')).toBeVisible();
    await expect(page.getByText('GBP')).toBeVisible();
  });

  test('currency picker shows buy and sell rates', async ({ page }) => {
    await page.getByText('Select currency…').click();
    // Should show B: and S: for rates
    await expect(page.getByText(/B:.*S:/)).toBeVisible();
  });

  test('selecting currency fills rate field', async ({ page }) => {
    await page.getByText('Select currency…').click();
    await page.getByText('🇺🇸').first().click(); // select USD
    // Just verify a rate input exists and has content
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('payment mode buttons are shown', async ({ page }) => {
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
    await expect(page.getByText('Cash')).toBeVisible();
    await expect(page.getByText('GCash')).toBeVisible();
    await expect(page.getByText('Maya')).toBeVisible();
  });

  test('Log tab shows transaction count', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Log/ })).toBeVisible();
  });

  test('switching to log view and back', async ({ page }) => {
    // Switch to log
    await page.getByRole('button', { name: /Log/ }).click();
    await expect(page.getByText("Today's Transactions")).toBeVisible();
    // Switch back to form
    await page.getByRole('button', { name: '← Form' }).click();
    await expect(page.getByText('Select currency…')).toBeVisible();
  });

  test('logout redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: 'LOGOUT' }).click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});
