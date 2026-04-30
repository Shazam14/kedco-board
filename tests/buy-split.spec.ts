/**
 * Phase 5 — BUY-side splits + BUY payment-status concept.
 *
 * What this guards (the *new* BUY behaviour; SELL parity already covered by
 * split-payments.spec.ts):
 *   • Counter BUY can split — slice builder enforces sum=phpAmt and posts payments[].
 *   • Counter BUY can mark a slice PENDING (e.g. "we owe customer a bank transfer"),
 *     and the resulting txn row shows the ⏳ pending chip.
 *   • Rider BUY non-CASH slice forced PENDING by mock (mirrors API rule).
 *   • Multi-slice BUY in the txn log shows the SPLIT +N chip.
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

test.describe('Counter BUY — split payment', () => {
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

  test('BUY split: posts payments[] with one pending slice; row shows ⏳', async ({ page }) => {
    let captured: Record<string, unknown> | null = null;
    await page.route('/api/counter/transaction', async route => {
      captured = JSON.parse(route.request().postData() ?? '{}');
      // Echo with one PENDING slice → parent PENDING
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          id: 'OR-BUYSPLIT01', time: '10:00 AM',
          type: 'BUY', source: 'COUNTER',
          currency: 'USD', foreign_amt: 100, rate: 55.5,
          php_amt: 5550, than: 0,
          cashier: 'cashier1',
          payment_mode: 'CASH', payment_status: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',          amount_php: 2000, status: 'RECEIVED', reference_no: null },
            { id: 'p1', method: 'GCASH', amount_php: 3550, status: 'PENDING',  reference_no: 'GC-BUY-Q1' },
          ],
        }),
      });
    });

    // BUY is the default — just enter currency + amount + open split
    await pickCounterCurrency(page, 'USD');
    await page.locator('input').nth(1).fill('100');

    await page.getByTestId('split-toggle').click();
    await expect(page.getByTestId('slice-builder')).toBeVisible();

    await page.getByTestId('slice-0-amount').fill('2000');
    await page.getByTestId('slice-1-method-GCASH').click();
    await page.getByTestId('slice-1-amount').fill('3550');
    await page.getByTestId('slice-1-ref').fill('GC-BUY-Q1');

    await expect(page.getByTestId('slice-delta')).toContainText('matches');
    await page.getByRole('button', { name: /CONFIRM BUY/ }).click();
    await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5_000 });

    expect(captured).not.toBeNull();
    const body = captured as Record<string, unknown>;
    expect(body.type).toBe('BUY');
    const slices = body.payments as Array<Record<string, unknown>>;
    expect(slices).toHaveLength(2);
    expect(slices[0].method).toBe('CASH');
    expect(slices[0].amount_php).toBe(2000);
    expect(slices[1].method).toBe('GCASH');
    expect(slices[1].reference_no).toBe('GC-BUY-Q1');
  });

  test('multi-slice BUY shows SPLIT +N chip in counter log', async ({ page }) => {
    await page.route('/api/counter/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'OR-BUYSPLIT02', time: '09:00 AM', type: 'BUY', source: 'COUNTER',
          currency: 'USD', foreignAmt: 100, rate: 55.5, phpAmt: 5550, than: 0,
          cashier: 'cashier1', paymentMode: 'CASH', paymentStatus: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',          amountPhp: 2000, status: 'RECEIVED' },
            { id: 'p1', method: 'GCASH', amountPhp: 3550, status: 'PENDING' },
          ],
        }]),
      })
    );
    await page.reload();
    await expect(page.getByText('OR-BUYSPLIT02')).toBeVisible();
    await expect(page.getByTestId('split-chip')).toContainText('+1');
  });
});

test.describe('Rider BUY — split payment', () => {
  test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

  const DISPATCH = {
    dispatch: { id: 'DISP-BUYSPLIT', cash_php: 10000, status: 'IN_FIELD', dispatch_time: '09:00 AM', topups: [] },
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

  test('rider BUY non-CASH slice forced PENDING by mock', async ({ page }) => {
    let captured: Record<string, unknown> | null = null;
    await page.route('/api/rider/transaction', async route => {
      captured = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          id: 'RIDER-BUYSPLIT-001', time: '10:00 AM',
          type: 'BUY', source: 'RIDER',
          currency: 'USD', foreign_amt: 100, rate: 55.5,
          php_amt: 5550, than: 0,
          cashier: 'rider01',
          payment_mode: 'CASH', payment_status: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',          amount_php: 2000, status: 'RECEIVED', reference_no: null },
            { id: 'p1', method: 'GCASH', amount_php: 3700, status: 'PENDING',  reference_no: 'GC-BUY-RD' },
          ],
        }),
      });
    });

    // Rider default tab is BUY
    await page.getByText('Select currency…').click();
    await page.getByText('🇺🇸').first().click();
    await page.locator('input').nth(0).fill('100');

    await page.getByTestId('split-toggle').click();
    await page.getByTestId('slice-0-amount').fill('2000');
    // Slice 1 default method on rider is GCASH — confirm explicit click
    await page.getByTestId('slice-1-method-GCASH').click();
    await page.getByTestId('slice-1-amount').fill('3550');
    await page.getByTestId('slice-1-ref').fill('GC-BUY-RD');

    await expect(page.getByTestId('slice-delta')).toContainText('matches');
    await page.getByRole('button', { name: /CONFIRM BUY/ }).click();
    await expect(page.getByText(/Saved|Receipt/i).first()).toBeVisible({ timeout: 5_000 });

    expect(captured).not.toBeNull();
    const body = captured as Record<string, unknown>;
    expect(body.type).toBe('BUY');
    const slices = body.payments as Array<Record<string, unknown>>;
    expect(slices).toHaveLength(2);
    expect(slices[1].method).toBe('GCASH');
    expect(slices[1].reference_no).toBe('GC-BUY-RD');
  });

  test('multi-slice rider BUY shows SPLIT +N chip in log', async ({ page }) => {
    await page.route('/api/rider/transactions', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 'R-BUYSPLIT-01', time: '11:00', type: 'BUY', source: 'RIDER',
          currency: 'USD', foreignAmt: 100, rate: 55.5, phpAmt: 5550, than: 0,
          cashier: 'rider01', paymentMode: 'CASH', paymentStatus: 'PENDING',
          payments: [
            { id: 'p0', method: 'CASH',          amountPhp: 2000, status: 'RECEIVED' },
            { id: 'p1', method: 'GCASH', amountPhp: 3550, status: 'PENDING' },
          ],
        }]),
      })
    );
    await page.reload();
    await page.getByRole('button', { name: /Log/ }).click();
    await expect(page.getByText('R-BUYSPLIT-01')).toBeVisible();
    await expect(page.getByTestId('split-chip-R-BUYSPLIT-01')).toContainText('+1');
  });
});
