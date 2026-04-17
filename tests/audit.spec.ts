/**
 * Audit Trail E2E tests.
 * Verifies that the audit log page is admin-only and that
 * filtering, row display, and expand/collapse all work correctly.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// ── Admin tests ───────────────────────────────────────────────────────────────

test.describe('Audit Trail — admin', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/audit');
  });

  test('page loads and shows header', async ({ page }) => {
    await expect(page.getByText('Audit Log')).toBeVisible();
    await expect(page.getByText('Every create, edit, and delete')).toBeVisible();
  });

  test('shows table column headers', async ({ page }) => {
    await expect(page.getByText('WHEN').first()).toBeVisible();
    await expect(page.getByText('ACTION').first()).toBeVisible();
    await expect(page.getByText('TABLE').first()).toBeVisible();
    await expect(page.getByText('BY').first()).toBeVisible();
    await expect(page.getByText('SUMMARY').first()).toBeVisible();
  });

  test('renders audit entries from mock API', async ({ page }) => {
    // Mock API returns 5 fixture entries
    await expect(page.getByText('supervisor1').first()).toBeVisible();
    await expect(page.getByText('cashier1').first()).toBeVisible();
    // Should show multiple entries
    await expect(page.getByText(/entr/)).toBeVisible(); // "5 entries"
  });

  test('shows action badges with correct labels', async ({ page }) => {
    await expect(page.getByText('+ CREATE').first()).toBeVisible();
    await expect(page.getByText('✎ UPDATE').first()).toBeVisible();
  });

  test('shows table labels (not raw names)', async ({ page }) => {
    await expect(page.getByText('Rate').first()).toBeVisible();
    await expect(page.getByText('Transaction').first()).toBeVisible();
  });

  test('filter by TABLE — rates', async ({ page }) => {
    await page.getByRole('button', { name: 'Rate', exact: true }).click();
    // Only the rates entry (AUD-001) should remain
    await expect(page.getByText('supervisor1').first()).toBeVisible();
    await expect(page.getByText('cashier1')).not.toBeVisible();
  });

  test('filter by ACTION — CREATE', async ({ page }) => {
    // The CREATE action filter button (in the ACTION section)
    const createButtons = page.getByRole('button', { name: 'CREATE', exact: true });
    await createButtons.first().click();
    await expect(page.getByText('+ CREATE').first()).toBeVisible();
    // UPDATE badge should not appear
    await expect(page.getByText('✎ UPDATE')).not.toBeVisible();
  });

  test('filter by user — admin', async ({ page }) => {
    await page.fill('input[placeholder="Filter by username…"]', 'admin');
    // Wait for debounce / re-fetch
    await page.waitForTimeout(600);
    await expect(page.getByText('admin').first()).toBeVisible();
    await expect(page.getByText('cashier1', { exact: true })).not.toBeVisible();
  });

  test('ALL filter button resets TABLE filter', async ({ page }) => {
    // Select rates filter first
    await page.getByRole('button', { name: 'Rate', exact: true }).click();
    await expect(page.getByText('cashier1', { exact: true })).not.toBeVisible();
    // Click ALL in TABLE group (first ALL button)
    await page.getByRole('button', { name: 'ALL', exact: true }).first().click();
    await expect(page.getByText('cashier1').first()).toBeVisible();
  });

  test('Refresh button refetches data', async ({ page }) => {
    await expect(page.getByText('supervisor1').first()).toBeVisible();
    await page.getByRole('button', { name: '↺ Refresh' }).click();
    await expect(page.getByText('supervisor1').first()).toBeVisible();
  });

  test('clicking a row expands the diff panel', async ({ page }) => {
    // Click the first UPDATE row (AUD-001 — rates UPDATE)
    const firstUpdateRow = page.getByText('✎ UPDATE').first();
    await firstUpdateRow.click();
    // Expanded panel shows RECORD label
    await expect(page.getByText(/RECORD:/)).toBeVisible();
    // Should show field diffs (buy_rate changed)
    await expect(page.getByText('buy_rate').first()).toBeVisible();
  });

  test('expanded UPDATE row shows old → new values', async ({ page }) => {
    await page.getByText('✎ UPDATE').first().click();
    // old value crossed out, new value shown
    await expect(page.getByText('→').first()).toBeVisible();
  });

  test('clicking expanded row collapses it', async ({ page }) => {
    await page.getByText('✎ UPDATE').first().click();
    await expect(page.getByText(/RECORD:/)).toBeVisible();
    // Click again to collapse
    await page.getByText('✎ UPDATE').first().click();
    await expect(page.getByText(/RECORD:/)).not.toBeVisible();
  });

  test('CREATE row expansion shows new values', async ({ page }) => {
    // Find a CREATE row and expand it
    await page.getByText('+ CREATE').first().click();
    await expect(page.getByText(/RECORD:/)).toBeVisible();
    // CREATE shows new_value fields in green — check a known field from AUD-002
    await expect(page.getByText('type').first()).toBeVisible();
  });

  test('entry count displayed at bottom', async ({ page }) => {
    await expect(page.getByText('5 entries')).toBeVisible();
  });
});

// ── Access control ─────────────────────────────────────────────────────────────

test.describe('Audit Trail — supervisor cannot access', () => {
  test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

  test('redirects supervisor away from /admin/audit', async ({ page }) => {
    await page.goto('/admin/audit');
    // Should be redirected to /dashboard (not /login, since supervisor IS logged in)
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Audit Trail — unauthenticated redirect', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Admin panel card ──────────────────────────────────────────────────────────

test.describe('Admin panel — Audit Trail card', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test('shows Audit Trail card on /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Audit Trail')).toBeVisible();
    await expect(page.getByText('Every create, edit, and delete')).toBeVisible();
  });

  test('Audit Trail card links to /admin/audit', async ({ page }) => {
    await page.goto('/admin');
    await page.getByText('Audit Trail').click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });
});
