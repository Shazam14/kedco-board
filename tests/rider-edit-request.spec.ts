/**
 * Rider can request edits on their own same-day txns. Mirrors the cashier
 * edit flow but with rider-specific fields:
 *   • BUY  → branch_id (BOUGHT FROM picker)
 *   • SELL → customer_id (CustomerPicker) + payment_mode
 *
 * Approval still goes through admin (admin/edit-requests queue) — this test
 * only covers the rider's submit path + the ⏳ pending indicator.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const MOCK_API = 'http://localhost:9999';
async function resetMockState(request: import('@playwright/test').APIRequestContext) {
  await request.post(`${MOCK_API}/api/v1/test/reset`);
}

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

const DISPATCH = {
  dispatch: { id: 'DISP-EDIT-001', cash_php: 50000, status: 'IN_FIELD', dispatch_time: '09:00 AM', topups: [] },
};

const TXNS = [
  {
    id: 'T-EDIT-BUY', time: '10:00', type: 'BUY', source: 'RIDER',
    currency: 'JPY', foreignAmt: 30000, rate: 0.373, phpAmt: 11190, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
  {
    id: 'T-EDIT-SELL', time: '11:00', type: 'SELL', source: 'RIDER',
    currency: 'JPY', foreignAmt: 30000, rate: 0.379, phpAmt: 11370, than: 180,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
    customer: null, customerId: null, paymentMode: 'CASH',
  },
];

test.describe('Rider can request edits on own same-day txns', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMockState(request);
    await page.route('/api/rider/dispatch', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DISPATCH) })
    );
    await page.route('/api/rider/transactions', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TXNS) })
    );
    await page.route('/api/rider/borrow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('/api/rider/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/rider');
    await page.getByRole('button', { name: /Log/ }).click();
  });

  test('BUY row → edit modal shows branch picker, submitting flips to ⏳', async ({ page }) => {
    let postedBody: Record<string, unknown> | null = null;
    await page.route('/api/rider/transactions/T-EDIT-BUY/edit-request', async route => {
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'req-1', txn_id: 'T-EDIT-BUY', status: 'PENDING' }),
      });
    });

    await page.getByTestId('rider-edit-btn-T-EDIT-BUY').click();
    const modal = page.getByTestId('rider-edit-modal');
    await expect(modal).toBeVisible();
    // Branch picker present for BUY
    await expect(page.getByTestId('rider-edit-branch')).toBeVisible();
    // Customer picker NOT shown for BUY (no node)
    await expect(modal.getByText('CUSTOMER', { exact: true })).toHaveCount(0);

    // Change branch from MAIN → BAI
    await page.getByTestId('rider-edit-branch').selectOption('BAI');
    await page.getByTestId('rider-edit-submit').click();

    // Confirmation surface + payload
    await expect(modal.getByText(/Request Submitted/)).toBeVisible();
    expect(postedBody).toMatchObject({ branch_id: 'BAI' });

    // Close — the row should now show ⏳ EDIT PENDING and the EDIT button is gone
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('edit-pending-T-EDIT-BUY')).toBeVisible();
    await expect(page.getByTestId('rider-edit-btn-T-EDIT-BUY')).toHaveCount(0);
  });

  test('SELL row → edit modal exposes customer picker + payment mode', async ({ page }) => {
    let postedBody: Record<string, unknown> | null = null;
    await page.route('/api/rider/transactions/T-EDIT-SELL/edit-request', async route => {
      postedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'req-2', txn_id: 'T-EDIT-SELL', status: 'PENDING' }),
      });
    });

    await page.getByTestId('rider-edit-btn-T-EDIT-SELL').click();
    const modal = page.getByTestId('rider-edit-modal');
    await expect(modal).toBeVisible();
    // Branch picker NOT shown on SELL
    await expect(modal.getByText('BOUGHT FROM', { exact: true })).toHaveCount(0);
    // Customer picker IS shown on SELL
    await expect(modal.getByText('CUSTOMER', { exact: true })).toBeVisible();

    // Pick a customer via the picker
    await modal.locator('input[placeholder="search by name…"]').fill('Hannah');
    await modal.getByText('Hannah Wu').first().click();

    // Change payment mode to GCash
    await modal.getByRole('button', { name: /GCash/ }).click();

    await page.getByTestId('rider-edit-submit').click();
    await expect(modal.getByText(/Request Submitted/)).toBeVisible();

    expect(postedBody).toMatchObject({ payment_mode: 'GCASH' });
    expect(postedBody).toHaveProperty('customer_id');
    expect(postedBody).toHaveProperty('customer', 'Hannah Wu');
  });

  test('Submit with no changes → "No changes detected" error', async ({ page }) => {
    await page.getByTestId('rider-edit-btn-T-EDIT-BUY').click();
    await page.getByTestId('rider-edit-submit').click();
    await expect(page.getByTestId('rider-edit-modal').getByText(/No changes detected/)).toBeVisible();
  });
});
