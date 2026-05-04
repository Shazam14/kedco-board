/**
 * Safe / Vault tracking — treasurer-facing surfaces.
 *
 * The "safe" is a single shared PHP vault. Treasurers pull cash from it to
 * fund cashier replenishments. The /supervisor page surfaces the running
 * balance and lets a treasurer record manual deposits/withdrawals.
 *
 * Uses page.route() for isolation — multiple workers share a single mock-api
 * with module-scoped SAFE_MOVEMENTS, so per-test stubbed responses prevent
 * accumulation flakes (per project test-isolation rule).
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join('tests', '.auth', 'supervisor.json') });

const today = new Date().toISOString().slice(0, 10);

type Movement = {
  id: string;
  amount_php: number;
  reason: string;
  note: string | null;
  actor_username: string;
  created_at: string;
};

async function stubSafe(page: Page) {
  let movements: Movement[] = [];
  const summary = () => {
    const net = Math.round(movements.reduce((s, m) => s + m.amount_php, 0) * 100) / 100;
    return { date: today, today_net: net, running_net: net, movements };
  };
  await page.route('**/api/admin/safe', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary()) });
    } else {
      const body = JSON.parse(route.request().postData() ?? '{}');
      const m: Movement = {
        id: `sm-${Date.now()}-${Math.random()}`,
        amount_php: body.amount_php,
        reason: (body.reason ?? 'OTHER').toUpperCase(),
        note: body.note ?? null,
        actor_username: 'supervisor1',
        created_at: new Date().toISOString(),
      };
      movements = [m, ...movements];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(m) });
    }
  });
}

test.describe('Safe card on /supervisor', () => {
  test('renders today net + running net + + MOVEMENT button', async ({ page }) => {
    await stubSafe(page);
    await page.goto('/supervisor');
    await expect(page.getByText('SAFE / VAULT')).toBeVisible();
    await expect(page.getByTestId('safe-today-net')).toBeVisible();
    await expect(page.getByTestId('safe-running-net')).toBeVisible();
    await expect(page.getByTestId('safe-add-movement')).toBeVisible();
  });

  test('manual deposit appears in the list and bumps the net', async ({ page }) => {
    await stubSafe(page);
    await page.goto('/supervisor');
    await page.getByTestId('safe-add-movement').click();

    await page.getByTestId('safe-direction-IN').click();
    await page.getByTestId('safe-amount').fill('250000');
    await page.getByTestId('safe-reason').selectOption('MANUAL_DEPOSIT');
    await page.getByTestId('safe-note').fill('e2e deposit');
    await page.getByTestId('safe-submit').click();

    await expect(page.getByTestId('safe-movements-list')).toContainText('MANUAL_DEPOSIT');
    await expect(page.getByTestId('safe-movements-list')).toContainText('+₱250,000.00');
    await expect(page.getByTestId('safe-today-net')).toContainText('+₱250,000.00');
  });

  test('withdrawal direction stores a negative amount', async ({ page }) => {
    await stubSafe(page);
    await page.goto('/supervisor');
    await page.getByTestId('safe-add-movement').click();

    await page.getByTestId('safe-direction-OUT').click();
    await page.getByTestId('safe-amount').fill('40000');
    await page.getByTestId('safe-reason').selectOption('MANUAL_WITHDRAWAL');
    await page.getByTestId('safe-submit').click();

    await expect(page.getByTestId('safe-movements-list')).toContainText('−₱40,000.00');
  });
});
