/**
 * Regression guard for the rider BUY-by-branch feature.
 *
 * Two pieces:
 *   1. The BUY form has a "BOUGHT FROM (branch)" picker. SELL does not.
 *      It defaults to the device branch (kedco_branch); when a rider picks
 *      a different branch on a single BUY, an "Overriding device branch"
 *      notice appears so they know it's stamped per-txn, not globally.
 *   2. The balance card surfaces "BUYS BY SOURCE BRANCH" — a decomposition
 *      of total SPENT across the branches the rider bought from today,
 *      sorted by amount descending.
 *
 * Why: riders cover several branches per day. Without this split, all
 * BUY spend collapsed to "device branch", which broke the per-branch
 * stock summary. The picker + summary make source provenance honest.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

const DISPATCH = {
  dispatch: {
    id: 'DISP-BRANCH-001',
    cash_php: 100000,
    status: 'IN_FIELD',
    dispatch_time: '09:00 AM',
    topups: [],
  },
};

// 3 BUYs spread across MAIN/SM/BAI + 1 SELL (must NOT appear in branch summary).
// Sorted desc by phpAmt → MAIN(20k) > SM(15k) > BAI(10k).
const TXNS = [
  {
    id: 'T-BUY-MAIN', time: '10:00', type: 'BUY', source: 'RIDER',
    currency: 'USD', foreignAmt: 350, rate: 57.14, phpAmt: 20000, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
  {
    id: 'T-BUY-SM', time: '10:30', type: 'BUY', source: 'RIDER',
    currency: 'USD', foreignAmt: 260, rate: 57.69, phpAmt: 15000, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'SM',
  },
  {
    id: 'T-BUY-BAI', time: '11:00', type: 'BUY', source: 'RIDER',
    currency: 'USD', foreignAmt: 175, rate: 57.14, phpAmt: 10000, than: 0,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'BAI',
  },
  {
    id: 'T-SELL-MAIN', time: '11:30', type: 'SELL', source: 'RIDER',
    currency: 'USD', foreignAmt: 500, rate: 58.0, phpAmt: 29000, than: 430,
    cashier: 'rider01', paymentStatus: 'RECEIVED', branchId: 'MAIN',
  },
];

test.describe('Rider BUY-by-branch', () => {
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

  test('BOUGHT FROM picker is shown on BUY but not on SELL', async ({ page }) => {
    // Default tab is form, default type is BUY → picker visible
    await expect(page.getByText(/BOUGHT FROM/)).toBeVisible();

    // Toggle to SELL — picker disappears (no source-branch concept on a sell)
    await page.getByRole('button', { name: 'SELL', exact: true }).click();
    await expect(page.getByText(/BOUGHT FROM/)).toHaveCount(0);

    // Back to BUY — picker returns
    await page.getByRole('button', { name: 'BUY', exact: true }).click();
    await expect(page.getByText(/BOUGHT FROM/)).toBeVisible();
  });

  test('picker defaults to device branch; override notice appears when changed', async ({ page }) => {
    // Locate the BOUGHT FROM <select> (the only one in the BUY form)
    const picker = page.locator('select').filter({ hasText: 'select branch' }).first();
    await expect(picker).toBeVisible();
    // Default = device branch (rider auth state seeds kedco_branch=MAIN)
    await expect(picker).toHaveValue('MAIN');

    // No override notice initially
    await expect(page.getByText(/Overriding device branch/)).toHaveCount(0);

    // Pick a different branch — notice surfaces with the device-branch name
    await picker.selectOption('SM');
    await expect(page.getByText(/Overriding device branch \(Main\)/)).toBeVisible();

    // Pick same as device — notice goes away
    await picker.selectOption('MAIN');
    await expect(page.getByText(/Overriding device branch/)).toHaveCount(0);
  });

  test('BUYS BY SOURCE BRANCH summary card shows each branch sorted desc', async ({ page }) => {
    await expect(page.getByText('BUYS BY SOURCE BRANCH')).toBeVisible();

    const card = page.getByText('BUYS BY SOURCE BRANCH').locator('..');
    await expect(card).toContainText('Main');
    await expect(card).toContainText('−₱20,000.00');
    await expect(card).toContainText('SM');
    await expect(card).toContainText('−₱15,000.00');
    await expect(card).toContainText('Bai');
    await expect(card).toContainText('−₱10,000.00');

    // SELL must not pollute the branch summary
    await expect(card).not.toContainText('₱29,000.00');

    // Sort order: Main (20k) before SM (15k) before Bai (10k)
    const text = await card.innerText();
    const iMain = text.indexOf('Main');
    const iSM   = text.indexOf('SM');
    const iBai  = text.indexOf('Bai');
    expect(iMain).toBeGreaterThanOrEqual(0);
    expect(iSM).toBeGreaterThan(iMain);
    expect(iBai).toBeGreaterThan(iSM);
  });
});
