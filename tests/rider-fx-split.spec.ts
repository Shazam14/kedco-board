/**
 * Regression guard for the rider FX-proceeds split.
 *
 * The big "TOTAL PHP IN HAND" card on the rider balance view must show the
 * **float position only** (carry = dispatch + borrow − BUY spend), NOT the
 * inflated number that includes FX proceeds from sells.
 *
 * Why: the rider's PHP-on-hand decision (when to ask for a top-up, whether
 * they're running low) depends on float-only. FX proceeds collapse back to
 * PHP at remit; mixing them into the headline number masks float depletion.
 *
 * The end-of-day remit screen is the one place where FX proceeds *do* fold
 * back in — the input pre-fills with `remaining = carry + fxProceeds`, with
 * the breakdown spelled out above it.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

// Scenario:
//   dispatch.cash_php = 50,000   borrow = 0
//   BUY  ₱20,000  (RECEIVED)     → phpSpent
//   SELL ₱29,000  (RECEIVED)     → fxProceeds
//   carry     = 50000 + 0 − 20000           = 30,000  ← TOTAL PHP IN HAND
//   remaining = carry + 29000 (fxProceeds)  = 59,000  ← only on remit screen
const DISPATCH = {
  dispatch: {
    id: 'DISP-FX-001',
    cash_php: 50000,
    status: 'IN_FIELD',
    dispatch_time: '09:00 AM',
    topups: [],
  },
};

const TXNS = [
  {
    id: 'T-BUY-001', time: '10:15', type: 'BUY', source: 'RIDER',
    currency: 'USD', foreignAmt: 350, rate: 57.14, phpAmt: 20000, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
  {
    id: 'T-SELL-001', time: '11:30', type: 'SELL', source: 'RIDER',
    currency: 'USD', foreignAmt: 500, rate: 58.0, phpAmt: 29000, than: 430,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
];

test.describe('Rider FX-proceeds split', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/rider/dispatch', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DISPATCH) })
    );
    await page.route('/api/rider/transactions', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TXNS) })
    );
    await page.route('/api/rider/borrow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/rider');
  });

  test('TOTAL PHP IN HAND shows carry only — not carry + FX proceeds', async ({ page }) => {
    // Wait for the dispatched balance card (only renders once /api/rider/dispatch resolves)
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();

    // Big-total card = label + value, both in the same wrapping div.
    const totalCard = page.getByText('TOTAL PHP IN HAND').locator('..');
    await expect(totalCard).toContainText('₱30,000.00');           // carry
    await expect(totalCard).not.toContainText('₱59,000.00');       // remaining must NOT appear here
  });

  test('FX proceeds surface separately on the balance card', async ({ page }) => {
    await expect(page.getByText('FX PROCEEDS (from sells)')).toBeVisible();
    const fxRow = page.getByText('FX PROCEEDS (from sells)').locator('..');
    await expect(fxRow).toContainText('+₱29,000.00');
  });

  test('End Day breakdown spells out carry + FX proceeds, input pre-fills with remaining', async ({ page }) => {
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();
    await page.getByRole('button', { name: 'End Day' }).click();

    // Breakdown line: "carry ₱30,000.00 + FX proceeds ₱29,000.00"
    await expect(page.getByText(/carry ₱30,000\.00 \+ FX proceeds ₱29,000\.00/)).toBeVisible();

    // Input pre-fills with remaining = 59000.00 (toFixed format — no commas, no ₱)
    const phpReturnSection = page.getByText('PHP CASH RETURNING').locator('..');
    await expect(phpReturnSection.locator('input')).toHaveValue('59000.00');
  });
});
