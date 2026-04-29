/**
 * Regression guard for the rider FX-proceeds split.
 *
 * Two surfaces, same principle:
 *   • Balance card "TOTAL PHP IN HAND" = carry only (float you haven't spent
 *     on buys). FX proceeds shown as their own line, NOT summed in.
 *   • End Day "PHP CASH RETURNING" input default = carry only too.
 *     FX proceeds appear as a separate row on the modal — they're already
 *     in the txn log and reconciled there, not folded back into the
 *     cash-handover number. Flipped 2026-04-29 after rider feedback that
 *     the carry+FX sum was confusing the cash count.
 *
 * Why: a rider needs one clean number for "how much float am I returning?"
 * Mixing in FX proceeds (which are PHP collected from selling foreign
 * currency) inflates the cash-return figure and makes physical-count
 * reconciliation harder, not easier.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

// Scenario:
//   dispatch.cash_php = 50,000   borrow = 0
//   BUY  ₱20,000  (RECEIVED)     → phpSpent
//   SELL ₱29,000  (RECEIVED)     → fxProceeds
//   carry = 50000 + 0 − 20000 = 30,000  ← used by BOTH balance card & End Day input
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

  test('End Day input pre-fills with carry only (with commas) — FX proceeds shown as a separate row', async ({ page }) => {
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();
    await page.getByRole('button', { name: 'End Day' }).click();

    // Scope to the End Day modal — same labels exist on the balance card too.
    const modal = page.getByText('End of Day — Remit').locator('..');

    // Input pre-fills with carry = 30,000.00 (comma-formatted, no ₱)
    const phpReturnSection = modal.getByText('PHP CASH RETURNING').locator('..');
    await expect(phpReturnSection.locator('input')).toHaveValue('30,000.00');

    // FX proceeds row appears INSIDE the modal as its own card, NOT folded
    // into the input. The modal's row also exposes the "tracked separately"
    // helper so reconciliation intent is obvious to the rider.
    await expect(modal.getByText('tracked separately — already in the txn log')).toBeVisible();
    const fxRow = modal.getByText('tracked separately — already in the txn log').locator('../..');
    await expect(fxRow).toContainText('+₱29,000.00');

    // The old "carry + FX proceeds" inline-sum line must NOT come back
    await expect(page.getByText(/carry ₱30,000\.00 \+ FX proceeds/)).toHaveCount(0);
  });
});
