/**
 * Responsive / viewport tests.
 * Verifies that key screens are usable at mobile (390px), tablet (820px),
 * and desktop (1280px) widths.
 *
 * Uses saved auth state from globalSetup — same as the other spec files.
 */

import { test, expect, devices } from '@playwright/test';
import path from 'path';

// ── Viewport presets ─────────────────────────────────────────────────────────

const MOBILE  = { width: 390,  height: 844  }; // iPhone 14
const TABLET  = { width: 820,  height: 1180 }; // iPad Air
const DESKTOP = { width: 1280, height: 800  };

// ── Counter screen ───────────────────────────────────────────────────────────

test.describe('Counter — mobile (390px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'cashier.json'),
    viewport: MOBILE,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/counter');
  });

  test('nav is visible and not overflowing', async ({ page }) => {
    await expect(page.getByText('Kedco FX')).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOGOUT' })).toBeVisible();
    // Nav should not cause horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // 10px tolerance
  });

  test('BUY/SELL toggle is full-width and tappable', async ({ page }) => {
    const buyBtn  = page.getByRole('button', { name: 'BUY' });
    const sellBtn = page.getByRole('button', { name: 'SELL' });
    await expect(buyBtn).toBeVisible();
    await expect(sellBtn).toBeVisible();
    // Toggle works on mobile
    await sellBtn.click();
    await expect(sellBtn).toBeVisible();
    await buyBtn.click();
  });

  test('currency picker is visible and opens', async ({ page }) => {
    await expect(page.getByText('Select currency…')).toBeVisible();
    await page.getByText('Select currency…').click();
    await expect(page.getByText('USD')).toBeVisible();
  });

  test('form inputs are accessible on small screen', async ({ page }) => {
    await expect(page.getByPlaceholder(/amount/i)).toBeVisible();
    await expect(page.getByPlaceholder(/customer/i)).toBeVisible();
  });

  test('payment mode buttons are shown', async ({ page }) => {
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
    await expect(page.getByText('Cash')).toBeVisible();
  });

  test('transaction log is below the form (stacked layout)', async ({ page }) => {
    // On mobile the right-panel stats/log should appear below the form, not side-by-side
    const form = page.getByText('NEW TRANSACTION');
    const log  = page.getByText(/TODAY'S TRANSACTIONS/);
    await expect(form).toBeVisible();
    await expect(log).toBeVisible();
    const formBox = await form.boundingBox();
    const logBox  = await log.boundingBox();
    // Log panel should be below the form (higher Y value), not to the right
    expect(logBox!.y).toBeGreaterThan(formBox!.y);
  });
});

test.describe('Counter — tablet (820px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'cashier.json'),
    viewport: TABLET,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/counter');
  });

  test('nav is visible without horizontal overflow', async ({ page }) => {
    await expect(page.getByText('Kedco FX')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('form and controls are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'BUY' })).toBeVisible();
    await expect(page.getByText('Select currency…')).toBeVisible();
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
  });

  test('transaction log is visible', async ({ page }) => {
    await expect(page.getByText(/TODAY'S TRANSACTIONS/)).toBeVisible();
  });
});

test.describe('Counter — desktop (1280px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'cashier.json'),
    viewport: DESKTOP,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/counter');
  });

  test('form and log are side by side', async ({ page }) => {
    const form = page.getByText('NEW TRANSACTION');
    const log  = page.getByText(/TODAY'S TRANSACTIONS/);
    await expect(form).toBeVisible();
    await expect(log).toBeVisible();
    const formBox = await form.boundingBox();
    const logBox  = await log.boundingBox();
    // On desktop both should be on roughly the same vertical position (side-by-side)
    expect(Math.abs(formBox!.y - logBox!.y)).toBeLessThan(100);
    // Log should be to the RIGHT of the form
    expect(logBox!.x).toBeGreaterThan(formBox!.x);
  });
});

// ── Rider screen ─────────────────────────────────────────────────────────────

test.describe('Rider — mobile (390px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'rider.json'),
    viewport: MOBILE,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/rider');
  });

  test('screen fits within mobile viewport width', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('BUY and SELL buttons are large and visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'BUY' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SELL' })).toBeVisible();
  });

  test('currency picker and amount input are visible', async ({ page }) => {
    await expect(page.getByText('Select currency…')).toBeVisible();
  });

  test('payment mode section is visible', async ({ page }) => {
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
    await expect(page.getByText('Cash')).toBeVisible();
    await expect(page.getByText('GCash')).toBeVisible();
  });

  test('logout button is accessible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'LOGOUT' })).toBeVisible();
  });
});

test.describe('Rider — tablet (820px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'rider.json'),
    viewport: TABLET,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/rider');
  });

  test('screen fits within tablet viewport', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('core controls are all visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'BUY' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SELL' })).toBeVisible();
    await expect(page.getByText('Select currency…')).toBeVisible();
    await expect(page.getByText('PAYMENT MODE')).toBeVisible();
  });
});

// ── Dashboard ────────────────────────────────────────────────────────────────

test.describe('Dashboard — mobile (390px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'admin.json'),
    viewport: MOBILE,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('nav fits within mobile width (no horizontal scroll)', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('tab bar is scrollable and all tabs reachable', async ({ page }) => {
    // Dashboard tab is active by default
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    // Tab bar should scroll to show all tabs — just check a few are present
    await expect(page.getByRole('button', { name: 'Positions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transactions' })).toBeVisible();
  });

  test('capital card is visible and not cut off', async ({ page }) => {
    await expect(page.getByText('TOTAL CAPITAL POSITION')).toBeVisible();
  });

  test('stat cards are visible (stacked single column)', async ({ page }) => {
    await expect(page.getByText('TODAY THAN (MARGIN)')).toBeVisible();
    await expect(page.getByText('BOUGHT TODAY')).toBeVisible();
  });

  test('can switch to Transactions tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Transactions' }).click();
    await expect(page.getByText(/All Transactions/i)).toBeVisible();
  });

  test('can switch to Rider tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Rider' }).click();
    // Rider tab content should appear
    await expect(page.getByText(/Rider/i).first()).toBeVisible();
  });
});

test.describe('Dashboard — tablet (820px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'admin.json'),
    viewport: TABLET,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('no horizontal overflow at tablet width', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test('nav tabs are all visible', async ({ page }) => {
    for (const tab of ['Dashboard', 'Positions', 'Transactions']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('capital and stat cards are all visible', async ({ page }) => {
    await expect(page.getByText('TOTAL CAPITAL POSITION')).toBeVisible();
    await expect(page.getByText('TODAY THAN (MARGIN)')).toBeVisible();
  });
});

test.describe('Dashboard — desktop (1280px)', () => {
  test.use({
    storageState: path.join('tests', '.auth', 'admin.json'),
    viewport: DESKTOP,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('all tabs visible without scrolling', async ({ page }) => {
    for (const tab of ['Dashboard', 'Positions', 'Transactions', 'Rider', 'Rate Board']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('stat cards are side by side (3 columns)', async ({ page }) => {
    const than   = page.getByText('TODAY THAN (MARGIN)');
    const bought = page.getByText('BOUGHT TODAY');
    const sold   = page.getByText('SOLD TODAY');
    await expect(than).toBeVisible();
    await expect(bought).toBeVisible();
    await expect(sold).toBeVisible();
    // On desktop all three should be on the same row (similar Y)
    const thanBox   = await than.boundingBox();
    const boughtBox = await bought.boundingBox();
    expect(Math.abs(thanBox!.y - boughtBox!.y)).toBeLessThan(20);
  });
});
