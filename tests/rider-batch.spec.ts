/**
 * Rider can submit a batch of multi-currency transactions per customer.
 * Mirrors the cashier batch flow but on a phone-sized stacked-card cart.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'rider.json') });

const DISPATCH = {
  dispatch: {
    id: 'DISP-BATCH-001',
    cash_php: 100000,
    status: 'IN_FIELD',
    dispatch_time: '09:00 AM',
    topups: [],
  },
};

test.describe('Rider batch transactions', () => {
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

  async function fillItem(page: import('@playwright/test').Page, amount: string, rate: string) {
    await page.getByText('Select currency…').click();
    await page.getByText('🇺🇸').first().click();
    const inputs = page.locator('input[inputmode="decimal"]');
    await inputs.first().fill(amount);
    await inputs.nth(1).fill(rate);
  }

  test('+ ADD TO BATCH appears once item is filled; clicking adds a cart card', async ({ page }) => {
    await fillItem(page, '100', '57');

    const addBtn = page.getByTestId('rider-add-to-batch');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    await expect(page.getByTestId('rider-cart')).toBeVisible();
    await expect(page.getByTestId('rider-cart-item-0')).toContainText('USD');
    await expect(page.getByText(/BATCH BUY \(1\)/)).toBeVisible();
  });

  test('SUBMIT BATCH posts items + customer to /api/rider/transactions/batch', async ({ page }) => {
    let captured: { type: string; source: string; customer?: string; items: { currency: string; foreign_amt: number }[] } | null = null;
    await page.route('/api/rider/transactions/batch', async route => {
      captured = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify((captured?.items ?? []).map((it, i) => ({
          id: `RD-BATCH-${i}`, time: '10:00', type: captured!.type, source: 'RIDER',
          currency: it.currency, foreign_amt: it.foreign_amt, rate: 57,
          php_amt: it.foreign_amt * 57, than: 0,
          cashier: 'rider01', customer: captured!.customer ?? null,
          payment_mode: 'CASH', payment_status: 'RECEIVED',
        }))),
      });
    });

    await fillItem(page, '100', '57');
    await page.getByTestId('rider-add-to-batch').click();

    await expect(page.getByText(/BATCH BUY \(1\)/)).toBeVisible();

    await page.getByTestId('rider-batch-submit').click();

    // Confirm payload + flash
    await expect.poll(() => captured).not.toBeNull();
    expect(captured!.source).toBe('RIDER');
    expect(captured!.type).toBe('BUY');
    expect(captured!.items).toHaveLength(1);
    expect(captured!.items[0].currency).toBe('USD');

    await expect(page.getByTestId('rider-batch-flash')).toContainText('BATCH SAVED');
  });
});
