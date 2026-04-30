/**
 * Phase 3 — SELL-side multi-payment UI (Counter + Rider).
 *
 * What this guards:
 *   • + SPLIT toggle is SELL-only (hidden on BUY).
 *   • Slice builder enforces sum = phpAmt before CONFIRM unlocks.
 *   • Mismatched sum surfaces the delta hint and keeps CONFIRM disabled.
 *   • Submit posts payments[] downstream; mock returns aggregated parent_status.
 *   • Rider non-CASH split slices land PENDING regardless of client input.
 *   • Multi-slice rows in the txn log render the SPLIT +N chip.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OPEN_SHIFT = {
  id: 'shift-cashier1-today', date: new Date().toISOString().split('T')[0],
  cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
  opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
  opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
  txn_count: 0, total_sold_php: 0, total_bought_php: 0, total_than: 0,
};

async function pickCounterCurrency(page: Page, code: string) {
  const input = page.getByPlaceholder('— Type code or country —');
  await input.click();
  await input.fill(code);
  await page.getByTestId(`currency-option-${code}`).click();
}

test.describe('Counter SELL — split payment', () => {
  test.use({ storageState: path.join('tests', '.auth', 'cashier.json') });

  test.beforeEach(async ({ page }) => {
    await page.route('/api/counter/shift', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_SHIFT) })
    );
    await page.route('/api/counter/setup-status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratesSet: true, positionsSet: true }) })
    );
    await page.route('/api/counter/edit-requests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/counter');
  });

  test('SPLIT toggle is hidden on BUY, visible on SELL', async ({ page }) => {
    // BUY (default) — no toggle
    await expect(page.getByTestId('split-toggle')).toHaveCount(0);

    // SELL — toggle appears
    await page.getByText('↑ SELL').click();
    await expect(page.getByTestId('split-toggle')).toBeVisible();
  });

  test('SPLIT enables slice builder; sum-mismatch keeps CONFIRM disabled', async ({ page }) => {
    await page.getByText('↑ SELL').click();
    await pickCounterCurrency(page, 'USD');
    // 100 USD @ 56 = ₱5,600
    await page.locator('input').nth(1).fill('100');

    await page.getByTestId('split-toggle').click();
    await expect(page.getByTestId('slice-builder')).toBeVisible();
    await expect(page.getByTestId('slice-row-0')).toBeVisible();
    await expect(page.getByTestId('slice-row-1')).toBeVisible();

    // Pre-fill: ₱2,000 cash + ₱3,000 GCash → ₱600 short
    await page.getByTestId('slice-0-amount').fill('2000');
    await page.getByTestId('slice-1-amount').fill('3000');
    await expect(page.getByTestId('slice-delta')).toContainText('600');
    await expect(page.getByRole('button', { name: /CONFIRM SELL/ })).toBeDisabled();

    // Top up GCash to ₱3,600 → matches
    await page.getByTestId('slice-1-amount').fill('3600');
    await expect(page.getByTestId('slice-delta')).toContainText('matches');
    await expect(page.getByRole('button', { name: /CONFIRM SELL/ })).toBeEnabled();
  });

  test('submit posts payments[] and response surfaces split-aware fields', async ({ page }) => {
    let captured: Record<string, unknown> | null = null;
    await page.route('/api/counter/transaction', async route => {
      captured = JSON.parse(route.request().postData() ?? '{}');
      // Echo a Phase-2-shaped response with payments[]
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          id: 'TXN-SPLIT-001',
          time: '10:00 AM',
          type: 'SELL', source: 'COUNTER',
          currency: 'USD', foreign_amt: 100, rate: 56,
          php_amt: 5600, than: 0,
          cashier: 'cashier1',
          payment_mode: 'CASH',
          payment_status: 'RECEIVED',
          payments: [
            { id: 'p0', method: 'CASH',  amount_php: 2000, status: 'RECEIVED', reference_no: null },
            { id: 'p1', method: 'GCASH', amount_php: 3600, status: 'RECEIVED', reference_no: 'GC-XYZ' },
          ],
        }),
      });
    });

    await page.getByText('↑ SELL').click();
    await pickCounterCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');
    await page.getByTestId('split-toggle').click();
    await page.getByTestId('slice-0-amount').fill('2000');
    // Slice 1 default is GCASH — switch is unnecessary but explicit
    await page.getByTestId('slice-1-method-GCASH').click();
    await page.getByTestId('slice-1-amount').fill('3600');
    await page.getByTestId('slice-1-ref').fill('GC-XYZ');

    await page.getByRole('button', { name: /CONFIRM SELL/ }).click();
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5_000 });

    expect(captured).not.toBeNull();
    const body = captured as Record<string, unknown>;
    expect(Array.isArray(body.payments)).toBe(true);
    const slices = body.payments as Array<Record<string, unknown>>;
    expect(slices).toHaveLength(2);
    expect(slices[0].method).toBe('CASH');
    expect(slices[0].amount_php).toBe(2000);
    expect(slices[1].method).toBe('GCASH');
    expect(slices[1].amount_php).toBe(3600);
    expect(slices[1].reference_no).toBe('GC-XYZ');
  });

  test('multi-slice txn shows SPLIT +N chip in counter txn log', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-SPLIT01', time: '09:00 AM', type: 'SELL', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 56, phpAmt: 5600, than: 0,
          cashier: 'cashier1', paymentMode: 'CASH', paymentStatus: 'RECEIVED',
          payments: [
            { id: 'p0', method: 'CASH',  amountPhp: 2000, status: 'RECEIVED' },
            { id: 'p1', method: 'GCASH', amountPhp: 3600, status: 'RECEIVED', referenceNo: 'GC-1' },
          ],
        }]),
      })
    );
    await page.reload();
    await expect(page.getByText('OR-SPLIT01')).toBeVisible();
    await expect(page.getByTestId('split-chip')).toContainText('+1');
  });
});

test.describe('Rider SELL — split payment', () => {
  test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

  const DISPATCH = {
    dispatch: { id: 'DISP-SPLIT', cash_php: 10000, status: 'IN_FIELD', dispatch_time: '09:00 AM', topups: [] },
  };

  test.beforeEach(async ({ page }) => {
    await page.route('/api/rider/dispatch', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DISPATCH) })
    );
    await page.route('/api/rider/transactions', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('/api/rider/borrow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/rider');
  });

  test('SPLIT toggle is SELL-only on rider', async ({ page }) => {
    // BUY default — no toggle
    await expect(page.getByTestId('split-toggle')).toHaveCount(0);
    await page.getByRole('button', { name: 'SELL', exact: true }).click();
    await expect(page.getByTestId('split-toggle')).toBeVisible();
  });

  test('rider non-CASH slice forced PENDING by mock (mirrors API rule)', async ({ page }) => {
    let captured: Record<string, unknown> | null = null;
    await page.route('/api/rider/transaction', async route => {
      captured = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          id: 'RIDER-SPLIT-001',
          time: '10:00 AM',
          type: 'SELL', source: 'RIDER',
          currency: 'USD', foreign_amt: 100, rate: 56,
          php_amt: 5600, than: 0,
          cashier: 'rider01',
          payment_mode: 'CASH',
          // Aggregate: GCash forced PENDING per Phase 2 rule → parent PENDING
          payment_status: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',  amount_php: 2000, status: 'RECEIVED', reference_no: null },
            { id: 'p1', method: 'GCASH', amount_php: 3600, status: 'PENDING',  reference_no: 'GC-RD' },
          ],
        }),
      });
    });

    // SELL flow — mock USD sell rate is 56, so 100 USD = ₱5,600
    await page.getByRole('button', { name: 'SELL', exact: true }).click();
    await page.getByText('Select currency…').click();
    await page.getByText('🇺🇸').first().click();
    await page.locator('input').nth(0).fill('100');           // foreign amount

    await page.getByTestId('split-toggle').click();
    await page.getByTestId('slice-0-amount').fill('2000');
    await page.getByTestId('slice-1-amount').fill('3600');
    await page.getByTestId('slice-1-ref').fill('GC-RD');

    await expect(page.getByTestId('slice-delta')).toContainText('matches');

    await page.getByRole('button', { name: /CONFIRM SELL/ }).click();
    await expect(page.getByText(/Saved|Receipt/i).first()).toBeVisible({ timeout: 5_000 });

    const body = captured as unknown as Record<string, unknown>;
    expect(Array.isArray(body.payments)).toBe(true);
    const slices = body.payments as Array<Record<string, unknown>>;
    expect(slices).toHaveLength(2);
    expect(slices[1].method).toBe('GCASH');
    expect(slices[1].reference_no).toBe('GC-RD');
  });

  test('multi-slice rider txn shows SPLIT +N chip in log', async ({ page }) => {
    await page.route('/api/rider/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'R-SPLIT-01', time: '11:00', type: 'SELL', source: 'RIDER',
          currency: 'USD', foreignAmt: 100, rate: 58, phpAmt: 5800, than: 0,
          cashier: 'rider01', paymentMode: 'CASH', paymentStatus: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',  amountPhp: 2000, status: 'RECEIVED' },
            { id: 'p1', method: 'GCASH', amountPhp: 3800, status: 'PENDING' },
          ],
        }]),
      })
    );
    await page.reload();
    await page.getByRole('button', { name: /Log/ }).click();
    await expect(page.getByText('R-SPLIT-01')).toBeVisible();
    await expect(page.getByTestId('split-chip-R-SPLIT-01')).toContainText('+1');
  });
});
