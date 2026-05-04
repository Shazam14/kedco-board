/**
 * PHP Capital — owner-contributed principal that funds the business.
 *
 * Distinct from safe_movements (operational vault flow) and bale (treasurer
 * movement). The admin /capital page records signed entries; the daily report
 * header shows a chip with the running total (admin only).
 *
 * Uses page.route() for isolation — multiple workers share a single mock-api,
 * so per-test stubbed responses prevent flakes (per project test-isolation rule).
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'admin.json') });

const today = new Date().toISOString().slice(0, 10);

test.describe('PHP Capital — admin', () => {
  test('records an entry; running total + ledger reflect it', async ({ page }) => {
    let entries: Array<{ id: string; amount_php: number; note: string | null; entry_date: string; created_by: string; created_at: string }> = [];

    await page.route('**/api/v1/capital/php', async route => {
      if (route.request().method() === 'GET') {
        const running_total = Math.round(entries.reduce((s, e) => s + e.amount_php, 0) * 100) / 100;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ running_total, entries }) });
      } else {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const entry = {
          id: `cap-${Date.now()}-${Math.random()}`,
          amount_php: body.amount_php,
          note: body.note ?? null,
          entry_date: body.entry_date ?? today,
          created_by: 'admin',
          created_at: new Date().toISOString(),
        };
        entries = [entry, ...entries];
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(entry) });
      }
    });
    await page.route('**/api/admin/capital', async route => {
      if (route.request().method() === 'GET') {
        const running_total = Math.round(entries.reduce((s, e) => s + e.amount_php, 0) * 100) / 100;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ running_total, entries }) });
      } else {
        const body = JSON.parse(route.request().postData() ?? '{}');
        const entry = {
          id: `cap-${Date.now()}-${Math.random()}`,
          amount_php: body.amount_php,
          note: body.note ?? null,
          entry_date: body.entry_date ?? today,
          created_by: 'admin',
          created_at: new Date().toISOString(),
        };
        entries = [entry, ...entries];
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(entry) });
      }
    });

    await page.goto('/admin/capital');

    await expect(page.getByText('No entries yet.')).toBeVisible();

    // Record a positive injection
    await page.getByPlaceholder('e.g. 500000 or -50000').fill('500000');
    await page.getByPlaceholder('e.g. Owner injection · withdrawal').fill('Initial principal');
    await page.getByRole('button', { name: '+ RECORD' }).click();
    await expect(page.getByText('Initial principal')).toBeVisible();
    await expect(page.getByText('+₱500,000.00').first()).toBeVisible();

    // Record a withdrawal
    await page.getByPlaceholder('e.g. 500000 or -50000').fill('-50000');
    await page.getByPlaceholder('e.g. Owner injection · withdrawal').fill('Owner draw');
    await page.getByRole('button', { name: '+ RECORD' }).click();
    await expect(page.getByText('Owner draw')).toBeVisible();
    await expect(page.getByText('−₱50,000.00').first()).toBeVisible();

    // Running total = 500k − 50k = 450k
    const runningCard = page.locator('div').filter({ hasText: /^RUNNING TOTAL/ }).first();
    await expect(runningCard).toContainText('₱450,000.00');
  });

  // Chip is rendered SSR — page.route() can't intercept the test server's
  // outbound fetch, so this test relies on mock-api global state. Reset before
  // and after to keep it sealed off from other specs.
  test('chip appears on daily report header reflecting running total', async ({ page, request }) => {
    const MOCK_API = 'http://localhost:9999';
    await request.post(`${MOCK_API}/api/v1/test/reset`);

    const seed = async (amt: number, note: string) =>
      request.post(`${MOCK_API}/api/v1/capital/php`, {
        headers: { 'Content-Type': 'application/json' },
        data: { amount_php: amt, note, entry_date: today },
      });
    await seed(1_000_000, 'chip-test seed');
    await seed(-200_000, 'chip-test draw');

    await page.goto('/admin/report');

    const chip = page.getByTestId('php-capital-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('PHP CAPITAL');
    await expect(chip).toContainText('₱800,000.00');

    await request.post(`${MOCK_API}/api/v1/test/reset`);
  });
});
