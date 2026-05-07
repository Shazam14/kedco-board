/**
 * Cheque-clear tab inside /supervisor/payables.
 * Each test stubs /api/admin/cheques/* via page.route() for isolation.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

const sample = [
  {
    payment_id: 'pay-cheque-001',
    txn_id: 'OR-TESTCHEQ',
    txn_date: '2026-05-07',
    amount_php: 50000,
    reference_no: 'CHK-12345',
    customer: 'Acme Corp',
    cashier: 'cashier1',
  },
];

test.describe('Cheque clearance tab', () => {
  test('tab switcher renders and shows seeded cheque', async ({ page }) => {
    await page.route('**/api/admin/cheques/pending', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(sample) })
    );
    await page.goto('/supervisor/payables');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('tab-payables')).toBeVisible();
    await expect(page.getByTestId('tab-cheques')).toBeVisible();

    await page.getByTestId('tab-cheques').click();

    await expect(page.getByTestId('cheques-panel')).toBeVisible();
    await expect(page.getByText('CHEQUES TO CLEAR — mark cleared once the bank confirms')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText(/cheque #CHK-12345/)).toBeVisible();
    await expect(page.getByText('1 cheque · ₱50,000.00')).toBeVisible();
  });

  test('clear button removes the cheque', async ({ page }) => {
    await page.route('**/api/admin/cheques/pending', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(sample) })
    );
    await page.route('**/api/admin/cheques/pay-cheque-001/clear', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          payment_id: 'pay-cheque-001',
          cleared_at: new Date().toISOString(),
          cleared_by: 'supervisor1',
        }),
      })
    );

    await page.goto('/supervisor/payables');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('tab-cheques').click();
    await expect(page.getByText('Acme Corp')).toBeVisible();

    await page.getByTestId('clear-pay-cheque-001').click();

    await expect(page.getByText('No cheques pending clearance.')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toHaveCount(0);
  });
});
