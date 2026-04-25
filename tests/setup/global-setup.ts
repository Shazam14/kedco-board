/**
 * Runs once before all tests.
 * Logs in as each role and saves the cookie state so tests can start pre-authenticated.
 * Auth state files are written to tests/.auth/ (gitignored).
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';

const ROLES = [
  { username: 'admin',       file: 'admin.json',      expectPath: '/dashboard' },
  { username: 'supervisor1', file: 'supervisor.json',  expectPath: '/dashboard' },
  { username: 'cashier1',    file: 'cashier.json',     expectPath: '/counter'   },
  { username: 'rider01',     file: 'rider.json',       expectPath: '/rider'     },
];

// Pre-set device localStorage so modals don't block tests
const DEVICE_STATE: Record<string, Record<string, string>> = {
  'admin.json':      { kedco_branch: 'MAIN', kedco_terminal: 'Counter 1' },
  'cashier.json':    { kedco_branch: 'MAIN', kedco_terminal: 'Counter 1' },
  'supervisor.json': { kedco_branch: 'MAIN', kedco_terminal: 'Counter 1' },
  'rider.json':      { kedco_branch: 'MAIN' },
};

export default async function globalSetup(_config: FullConfig) {
  const authDir = path.join(process.cwd(), 'tests', '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();

  for (const role of ROLES) {
    const context = await browser.newContext();
    const page    = await context.newPage();

    await page.route('**/turnstile/v0/api.js', route => route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = { render: (el, opts) => { opts.callback('test-token'); return 'fake-id'; } };`,
    }));
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[autocomplete="username"]', role.username);
    await page.fill('input[autocomplete="current-password"]', role.username); // mock API accepts any password
    await page.click('button[type="submit"]');

    await page.waitForURL(url => url.pathname !== '/login', { timeout: 15_000 });

    // Set device localStorage so device modal doesn't block tests
    const deviceItems = DEVICE_STATE[role.file] ?? {};
    for (const [k, v] of Object.entries(deviceItems)) {
      await page.evaluate(([key, val]) => localStorage.setItem(key, val), [k, v] as [string, string]);
    }

    const statePath = path.join(authDir, role.file);
    await context.storageState({ path: statePath });
    await context.close();

    console.log(`[global-setup] Saved auth state for ${role.username} → ${statePath}`);
  }

  await browser.close();
}
