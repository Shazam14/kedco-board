/**
 * Kedco FX — Edit Request Demo Walkthrough
 *
 * Shows the full approval flow:
 *   cashier1 notices a wrong customer name → submits edit request
 *   admin reviews the pending request → approves it
 *   transaction is updated, audit trail records the change
 *
 * Run:
 *   npx playwright test --config=playwright.demo.config.ts tests/demo/edit-requests.spec.ts
 *
 * Video: test-results/edit-requests-demo-chromium/video.webm
 */

import { test, expect } from '@playwright/test';

const pause = (ms = 1500) => new Promise(r => setTimeout(r, ms));

test('Edit Request — cashier submits, admin approves', async ({ page, browser }) => {

  // ── Part 1: Cashier spots a mistake ──────────────────────────────────────

  // Set up the cashier context
  let pendingRequest: Record<string, unknown> | null = null;

  await page.route('/api/counter/shift', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 'shift-demo', cashier: 'cashiertest', cashier_name: 'Cashier (Demo)',
          status: 'OPEN', opened_at: new Date().toISOString(),
          opening_cash_php: 10000, txn_count: 2,
          total_sold_php: 11200, total_bought_php: 27750, total_than: 100,
        }),
      });
    } else {
      await route.continue();
    }
  });

  const mockTxn = {
    id: 'OR-DEMO0001', time: '09:30 AM', type: 'BUY', source: 'COUNTER',
    currency: 'USD', foreignAmt: 500, rate: 55.50, phpAmt: 27750,
    than: 0, cashier: 'cashiertest', customer: 'Jaan Dela Cruz',
    payment_mode: 'CASH', bank_id: null,
  };

  await page.route('/api/counter/transactions', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([mockTxn]),
    });
  });

  await page.route('/api/counter/edit-requests', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(pendingRequest ? [mockTxn.id] : []),
    });
  });

  await page.route(`/api/counter/transactions/${mockTxn.id}/edit-request`, async route => {
    const body = await route.request().postDataJSON();
    pendingRequest = {
      id: 'req-demo-001', txn_id: mockTxn.id,
      txn_date: new Date().toISOString().split('T')[0],
      requested_by: 'cashiertest',
      current_values: { customer: mockTxn.customer, payment_mode: 'CASH', rate: 55.50, foreignAmt: 500, phpAmt: 27750, than: 0 },
      proposed: { customer: body.customer },
      note: body.note ?? null,
      status: 'PENDING',
      reviewed_by: null, reviewed_at: null, rejection_note: null,
      created_at: new Date().toISOString(),
    };
    await route.fulfill({ status: 201, contentType: 'application/json',
      body: JSON.stringify(pendingRequest),
    });
  });

  // Login as cashier
  await page.goto('/login');
  await pause(800);
  await page.locator('input[autocomplete="username"]').type('cashiertest', { delay: 80 });
  await pause(300);
  await page.locator('input[autocomplete="current-password"]').type('Demo@2026!', { delay: 60 });
  await pause(400);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/counter');
  await pause(1500);

  // See the transaction list — wait for the edit button to appear
  await expect(page.locator('[data-testid="edit-btn-OR-DEMO0001"]')).toBeVisible({ timeout: 10000 });
  await pause(1200);

  // Notice the wrong customer name — click edit
  await page.locator('[data-testid="edit-btn-OR-DEMO0001"]').click();
  await pause(1200);

  // Modal opens — "REQUEST EDIT"
  await expect(page.getByText('REQUEST EDIT')).toBeVisible();
  await pause(1000);

  // Fix the customer name — use .first() (the editable proposed-value input in the modal)
  const customerInput = page.locator('input[placeholder="Name or reference"]').first();
  await customerInput.fill('Juan Dela Cruz');
  await pause(1000);

  // Add a reason
  await page.locator('input[placeholder="e.g. wrong rate entered"]').fill('Typo in customer name');
  await pause(1200);

  // Submit
  await page.getByTestId('edit-submit-btn').click();
  await pause(1500);

  // Confirmation screen
  await expect(page.getByText('Request Submitted')).toBeVisible();
  await pause(2500);

  // Close and see the pending badge
  await page.getByRole('button', { name: 'Close' }).click();
  await pause(1200);
  await expect(page.locator('span[title="Edit request pending admin approval"]')).toBeVisible();
  await pause(2000);

  // ── Part 2: Admin reviews and approves ────────────────────────────────────

  // Open admin context
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();

  await adminPage.route('/api/admin/edit-requests*', async route => {
    const urlStatus = new URL(route.request().url()).searchParams.get('status');
    const filterStatus = urlStatus || 'PENDING';
    const matches = pendingRequest && (pendingRequest as Record<string, unknown>).status === filterStatus
      ? [pendingRequest] : [];
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(filterStatus === 'ALL' && pendingRequest ? [pendingRequest] : matches),
    });
  });

  await adminPage.route('/api/admin/edit-requests/req-demo-001/approve', async route => {
    if (pendingRequest) (pendingRequest as Record<string, unknown>).status = 'APPROVED';
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'approved' }),
    });
  });

  // Mock admin login cookie directly (simulate already-logged-in admin)
  await adminPage.goto('/login');
  await pause(600);
  await adminPage.locator('input[autocomplete="username"]').type('admintest', { delay: 80 });
  await pause(300);
  await adminPage.locator('input[autocomplete="current-password"]').type('Demo@2026!', { delay: 60 });
  await pause(400);
  await adminPage.getByRole('button', { name: /sign in/i }).click();
  await adminPage.waitForURL('**/dashboard', { timeout: 8000 }).catch(() => {});
  await pause(1000);

  // Go to edit requests
  await adminPage.goto('/admin/edit-requests');
  await pause(1500);

  // See the pending request
  await expect(adminPage.getByText('OR-DEMO0001')).toBeVisible();
  await pause(1200);

  // Expand it
  await adminPage.getByText('OR-DEMO0001').click();
  await pause(1500);

  // See the diff
  await expect(adminPage.getByText('PROPOSED CHANGES')).toBeVisible();
  await pause(2000);

  // Approve
  await adminPage.getByRole('button', { name: '✓ APPROVE' }).click();
  await pause(2000);

  // Request is gone from PENDING
  await expect(adminPage.getByText(/No pending requests/)).toBeVisible();
  await pause(2500);

  await adminCtx.close();
});
