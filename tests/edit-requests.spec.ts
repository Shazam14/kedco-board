/**
 * Edit Requests E2E tests.
 *
 * Uses page.route() to intercept all API calls — no dependency on mock-api state.
 * Pattern follows shifts.spec.ts: fixed intercepts, no cross-context flows.
 *
 * Covers:
 *  - Cashier submits edit request → pending badge shows
 *  - Duplicate request is blocked (edit btn hidden after submit)
 *  - Admin sees pending requests on /admin/edit-requests
 *  - Admin approves → status changes to APPROVED
 *  - Admin rejects with note → status changes to REJECTED
 *  - /admin/edit-requests is admin-only
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// ── Fixture data ──────────────────────────────────────────────────────────────

const PENDING_REQUEST = {
  id: 'req-test-001',
  txn_id: 'OR-TESTAAAA',
  txn_date: new Date().toISOString().split('T')[0],
  requested_by: 'cashier1',
  current_values: { customer: 'Juan dela Cruz', payment_mode: 'CASH', rate: 55.5, foreign_amt: 500, php_amt: 27750, than: 0 },
  proposed: { customer: 'Updated Name' },
  note: null,
  status: 'PENDING',
  reviewed_by: null, reviewed_at: null, rejection_note: null,
  created_at: new Date().toISOString(),
};

const PENDING_REQUEST_B = {
  ...PENDING_REQUEST,
  id: 'req-test-002',
  txn_id: 'OR-TESTBBBB',
  current_values: { customer: 'Maria Santos', payment_mode: 'CASH', rate: 56.0, foreign_amt: 200, php_amt: 11200, than: 100 },
  proposed: { customer: 'Reject Test' },
};

// ── Cashier flow ──────────────────────────────────────────────────────────────

test.describe('Cashier — edit request flow', () => {
  test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

  test.beforeEach(async ({ page }) => {
    // Guarantee open shift so the overlay never blocks the counter UI
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'shift-cashier1-today', date: new Date().toISOString().split('T')[0],
        cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
        opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
        opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
        txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
      }) })
    );
    await page.route('/api/counter/setup-status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratesSet: true, positionsSet: true }) })
    );
    // No pending edits on mount — so all edit buttons are visible
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  });

  test('edit button is visible on today\'s transactions', async ({ page }) => {
    await page.goto('/counter');
    await expect(page.locator('[data-testid^="edit-btn-"]').first()).toBeVisible();
  });

  test('clicking edit opens REQUEST EDIT modal', async ({ page }) => {
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-"]').first().click();
    await expect(page.getByText('REQUEST EDIT')).toBeVisible();
    await expect(page.getByText("Changes won't apply until admin approves.")).toBeVisible();
  });

  test('modal shows transaction details', async ({ page }) => {
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTAAAA"]').click();
    await expect(page.getByText('OR-TESTAAAA').first()).toBeVisible();
  });

  test('submitting edit request shows pending confirmation', async ({ page }) => {
    await page.route('/api/counter/transactions/OR-TESTAAAA/edit-request', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(PENDING_REQUEST) })
    );
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTAAAA"]').click();
    await page.locator('input[placeholder="Name or reference"]').first().fill('Updated Name');
    await page.getByTestId('edit-submit-btn').click();
    await expect(page.getByText('Request Submitted')).toBeVisible();
    await expect(page.getByText('Waiting for admin approval')).toBeVisible();
  });

  test('closing confirmation shows pending badge on transaction row', async ({ page }) => {
    await page.route('/api/counter/transactions/OR-TESTAAAA/edit-request', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(PENDING_REQUEST) })
    );
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTAAAA"]').click();
    await page.locator('input[placeholder="Name or reference"]').first().fill('Updated Name');
    await page.getByTestId('edit-submit-btn').click();
    await expect(page.getByText('Request Submitted')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    // React updates pendingEdits locally — no re-fetch needed
    await expect(page.locator('span[title="Edit request pending admin approval"]').first()).toBeVisible();
  });

  test('after submitting, edit btn replaced by pending badge', async ({ page }) => {
    await page.route('/api/counter/transactions/OR-TESTBBBB/edit-request', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(PENDING_REQUEST_B) })
    );
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTBBBB"]').click();
    await page.locator('input[placeholder="Name or reference"]').first().fill('First Edit');
    await page.getByTestId('edit-submit-btn').click();
    await page.getByRole('button', { name: 'Close' }).click();
    // Edit button is gone, ⏳ badge is there
    await expect(page.locator('[data-testid="edit-btn-OR-TESTBBBB"]')).not.toBeVisible();
    await expect(page.locator('span[title="Edit request pending admin approval"]')).toBeVisible();
  });

  test('no changes detected error', async ({ page }) => {
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTAAAA"]').click();
    // Don't change anything, just click submit
    await page.getByTestId('edit-submit-btn').click();
    await expect(page.getByText('No changes detected')).toBeVisible();
  });

  test('typing 0 in guide rate detects change and submits edit request', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-GUIDE001', time: '12:07 PM', type: 'BUY', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 60, phpAmt: 6000, than: 0,
          cashier: 'cashier1', paymentMode: 'CASH',
          officialRate: 60.8,
        }]),
      })
    );
    await page.route('/api/counter/transactions/OR-GUIDE001/edit-request', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        id: 'req-guide-001', txn_id: 'OR-GUIDE001', status: 'PENDING',
      }) })
    );
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-GUIDE001"]').click();
    // Guide rate is pre-filled with 60.8 — cashier types 0 to clear commission
    await page.getByPlaceholder('e.g. 56.50').fill('0');
    await page.getByTestId('edit-submit-btn').click();
    await expect(page.getByText('No changes detected')).not.toBeVisible();
    await expect(page.getByText('Request Submitted')).toBeVisible();
  });
});

// ── Admin: edit requests page ─────────────────────────────────────────────────

test.describe('Admin — edit requests page', () => {
  test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

  test('page loads with header and tabs', async ({ page }) => {
    await page.route('/api/admin/edit-requests**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/admin/edit-requests');
    await expect(page.getByText('Edit Requests').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'PENDING' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'APPROVED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'REJECTED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
  });

  test('empty PENDING state shows helpful message', async ({ page }) => {
    await page.route('/api/admin/edit-requests**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/admin/edit-requests');
    await expect(page.getByText(/No pending requests/)).toBeVisible();
  });

  test('shows pending request from cashier', async ({ page }) => {
    await page.route('/api/admin/edit-requests**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PENDING_REQUEST]) })
    );
    await page.goto('/admin/edit-requests');
    await expect(page.getByText('OR-TESTAAAA').first()).toBeVisible();
    await expect(page.getByText('cashier1').first()).toBeVisible();
    await expect(page.getByText('customer').first()).toBeVisible();
  });

  test('expanding a request shows field diff', async ({ page }) => {
    await page.route('/api/admin/edit-requests**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PENDING_REQUEST]) })
    );
    await page.goto('/admin/edit-requests');
    await page.getByText('OR-TESTAAAA').click();
    await expect(page.getByText('PROPOSED CHANGES')).toBeVisible();
    await expect(page.getByText('→').first()).toBeVisible();
  });

  test('admin can approve a request', async ({ page }) => {
    let approved = false;
    await page.route('/api/admin/edit-requests**', async route => {
      const url = route.request().url();
      if (url.includes('/approve')) {
        approved = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'approved' }) });
      }
      // After approval, PENDING tab is empty; APPROVED tab has the request
      const isApproved = url.includes('status=APPROVED');
      const isPending  = url.includes('status=PENDING');
      if (approved && isPending)  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (approved && isApproved) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...PENDING_REQUEST, status: 'APPROVED' }]) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PENDING_REQUEST]) });
    });

    await page.goto('/admin/edit-requests');
    await page.getByText('OR-TESTAAAA').first().click();
    await page.getByRole('button', { name: '✓ APPROVE' }).click();
    await expect(page.getByText('OR-TESTAAAA').first()).not.toBeVisible();
    await page.getByRole('button', { name: 'APPROVED' }).click();
    await expect(page.getByText('OR-TESTAAAA').first()).toBeVisible();
  });

  test('admin can reject a request with a reason', async ({ page }) => {
    let rejected = false;
    await page.route('/api/admin/edit-requests**', async route => {
      const url = route.request().url();
      if (url.includes('/reject')) {
        rejected = true;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'rejected' }) });
      }
      const isRejected = url.includes('status=REJECTED');
      const isPending  = url.includes('status=PENDING');
      if (rejected && isPending)  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (rejected && isRejected) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...PENDING_REQUEST_B, status: 'REJECTED', rejection_note: 'Rate is already correct' }]) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PENDING_REQUEST_B]) });
    });

    await page.goto('/admin/edit-requests');
    await page.getByText('OR-TESTBBBB').first().click();
    await page.getByRole('button', { name: '✕ Reject' }).click();
    await expect(page.getByText('Reject Request')).toBeVisible();
    await page.locator('textarea').fill('Rate is already correct');
    await page.getByRole('button', { name: 'CONFIRM REJECT' }).click();
    await expect(page.getByText('OR-TESTBBBB').first()).not.toBeVisible();
    await page.getByRole('button', { name: 'REJECTED' }).click();
    await expect(page.getByText('OR-TESTBBBB').first()).toBeVisible();
  });

  test('admin edit button does direct PATCH (no request flow)', async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'shift-admin-today', date: new Date().toISOString().split('T')[0],
        cashier: 'admin', cashier_name: 'Admin User', status: 'OPEN',
        opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
        opening_cash_php: 50000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
        txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
      }) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/counter');
    await page.locator('[data-testid^="edit-btn-OR-TESTAAAA"]').click();
    await expect(page.getByText('EDIT TRANSACTION')).toBeVisible();
    await expect(page.getByText("Changes won't apply until admin approves.")).not.toBeVisible();
    await expect(page.getByTestId('edit-submit-btn')).toHaveText('SAVE CHANGES');
  });

  test('admin panel shows Edit Requests card', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: /Edit Requests/ }).first()).toBeVisible();
    await expect(page.getByText('Review and approve cashier transaction edit requests').first()).toBeVisible();
  });

  test('Edit Requests card links to /admin/edit-requests', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /Edit Requests/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/edit-requests/);
  });
});

// ── Access control ────────────────────────────────────────────────────────────

test.describe('Edit Requests — access control', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/edit-requests');
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe('cashier cannot access /admin/edit-requests', () => {
    test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });
    test('redirects cashier away from admin page', async ({ page }) => {
      await page.goto('/admin/edit-requests');
      await expect(page).not.toHaveURL(/\/admin\/edit-requests/);
    });
  });
});
