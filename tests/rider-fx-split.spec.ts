/**
 * Regression guard for the rider PHP-in-hand display.
 *
 * Two surfaces, related but separate:
 *   • Balance card "TOTAL PHP IN HAND" = carry + FX proceeds from RECEIVED
 *     (cash) sells. Online sells default to PENDING server-side and don't
 *     contribute, so this number is "what's actually in the bag right now."
 *     The FX PROCEEDS row stays as the visible breakdown. Flipped 2026-04-29
 *     after Ken: admin still wants the sum, with the split shown above.
 *   • End Day "PHP CASH RETURNING" input default = carry only (unchanged —
 *     FX proceeds reconciled in the txn log, not folded into the cash
 *     handover). The split-display intent stays for that surface.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

// Scenario:
//   dispatch.cash_php = 50,000   borrow = 0
//   BUY  ₱20,000  (RECEIVED)     → phpSpent
//   SELL ₱29,000  (RECEIVED)     → fxProceeds
//   carry = 50000 + 0 − 20000 = 30,000
//   remaining = carry + fxProceeds = 59,000  ← TOTAL PHP IN HAND
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

test.describe('Rider PHP-in-hand display', () => {
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

  test('TOTAL PHP IN HAND = carry + cash-sell FX proceeds', async ({ page }) => {
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();

    const totalCard = page.getByText('TOTAL PHP IN HAND').locator('..');
    await expect(totalCard).toContainText('₱59,000.00');           // carry + fxProceeds
    await expect(totalCard).not.toContainText('₱30,000.00');       // carry-only must NOT be the headline anymore
  });

  test('FX proceeds surface separately on the balance card as the breakdown', async ({ page }) => {
    await expect(page.getByText('FX PROCEEDS (from sells)')).toBeVisible();
    const fxRow = page.getByText('FX PROCEEDS (from sells)').locator('..');
    await expect(fxRow).toContainText('+₱29,000.00');
  });

  test('End Day FCY row defaults to GROSS BOUGHT — sells shown separately, not deducted', async ({ page }) => {
    // Per Ken: End Day FCY should show what was sourced today (gross BUYS).
    // Sells are reconciled against the txn log, not deducted from the FCY input.
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();
    await page.getByRole('button', { name: 'End Transaction' }).click();

    const modal = page.getByText('End Transaction — Remit').locator('..');

    // USD input defaults to 350.00 (the gross BOUGHT), not -150 (350 - 500 sold).
    await expect(modal.getByTestId('endday-fcy-USD')).toHaveValue('350.00');

    // The SOLD-to-customers breakdown row appears below the input for transparency.
    await expect(modal.getByText('SOLD TO CUSTOMERS (already in txn log)')).toBeVisible();
    const soldRow = modal.getByText('SOLD TO CUSTOMERS (already in txn log)').locator('..');
    await expect(soldRow).toContainText('−500.00');
  });

  test('End Day input pre-fills with carry only — FX proceeds shown as a separate row', async ({ page }) => {
    await expect(page.getByText('TOTAL PHP IN HAND')).toBeVisible();
    await page.getByRole('button', { name: 'End Transaction' }).click();

    // Scope to the End Day modal — same labels exist on the balance card too.
    const modal = page.getByText('End Transaction — Remit').locator('..');

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
