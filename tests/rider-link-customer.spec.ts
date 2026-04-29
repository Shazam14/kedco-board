/**
 * Regression guard for the rider's "link a customer to an existing SELL"
 * flow on the txn log tab.
 *
 * Why it exists: the customer-DB picker on the rider FORM was added in
 * chunk 2 — it covers NEW txns from the moment the picker was deployed.
 * But the rider had a backlog of SELLs already on file with no customer
 * association (because the picker didn't exist yet, or because the
 * customer wasn't yet seeded into the master list when the txn was made).
 *
 * Per Ken: rider should be able to retroactively associate a customer to
 * a SELL row in the log so per-customer aggregates pick up that volume.
 *
 * Endpoint: POST /api/v1/transactions/{id}/customer (lightweight — no
 * audit, only sets customer_id; can't change rates/amounts).
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const MOCK_API = 'http://localhost:9999';
async function resetMockState(request: import('@playwright/test').APIRequestContext) {
  await request.post(`${MOCK_API}/api/v1/test/reset`);
}

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

const DISPATCH = {
  dispatch: { id: 'DISP-LINK-001', cash_php: 50000, status: 'IN_FIELD', dispatch_time: '09:00 AM', topups: [] },
};

const TXNS = [
  // SELL with no customer — the candidate for retroactive linking
  {
    id: 'T-SELL-LINK', time: '11:30', type: 'SELL', source: 'RIDER',
    currency: 'JPY', foreignAmt: 30000, rate: 0.379, phpAmt: 11385, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
    customer: null, customerId: null,
  },
  // BUY — should NOT show the link button (BUY is per-branch, not per-customer)
  {
    id: 'T-BUY-NOLINK', time: '10:00', type: 'BUY', source: 'RIDER',
    currency: 'JPY', foreignAmt: 160000, rate: 0.373, phpAmt: 59680, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
];

test.describe('Rider can link a customer to an existing SELL', () => {
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
    // Mock the link-customer save — production proxy hits mock-api which doesn't
    // know about our route-mocked txns, so we stub it deterministically here.
    await page.route(/\/api\/transactions\/[^/]+\/customer$/, async route => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'T-SELL-LINK', customer: 'Hannah Wu', customer_id: body.customer_id,
        }),
      });
    });
    await page.goto('/rider');
    await page.getByRole('button', { name: /Log/ }).click();
  });

  test('SELL row shows the LINK CUSTOMER button; BUY does not', async ({ page }) => {
    await expect(page.getByTestId('link-customer-T-SELL-LINK')).toBeVisible();
    await expect(page.getByTestId('link-customer-T-BUY-NOLINK')).toHaveCount(0);
  });

  test('clicking LINK CUSTOMER opens picker; saving attaches customer to the txn', async ({ page }) => {
    await page.getByTestId('link-customer-T-SELL-LINK').click();
    await expect(page.getByTestId('link-picker-T-SELL-LINK')).toBeVisible();

    // Save is disabled until a customer is picked
    await expect(page.getByTestId('link-save-T-SELL-LINK')).toBeDisabled();

    // Type into the picker and pick Hannah Wu from the seeded customer list
    const picker = page.getByTestId('link-picker-T-SELL-LINK');
    await picker.locator('input').fill('Hannah');
    await picker.getByText('Hannah Wu').first().click();

    await expect(page.getByTestId('link-save-T-SELL-LINK')).toBeEnabled();
    await page.getByTestId('link-save-T-SELL-LINK').click();

    // Picker closes and the row updates with ★ + customer name
    await expect(page.getByTestId('link-picker-T-SELL-LINK')).toHaveCount(0);
    const row = page.locator('div').filter({ hasText: 'T-SELL-LINK' }).first();
    await expect(row).toContainText('Hannah Wu');
  });
});
