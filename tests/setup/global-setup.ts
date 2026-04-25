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

export default async function globalSetup(_config: FullConfig) {
  const authDir = path.join(process.cwd(), 'tests', '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();

  for (const role of ROLES) {
    const context = await browser.newContext();
    const page    = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[autocomplete="username"]', role.username);
    await page.fill('input[autocomplete="current-password"]', role.username); // mock API accepts any password
    // Simulate Turnstile completion so the submit button becomes enabled
    await page.waitForFunction(() => typeof (window as any).handleTurnstile === 'function');
    await page.evaluate(() => (window as any).handleTurnstile('test-token'));
    await page.click('button[type="submit"]');

    await page.waitForURL(url => url.pathname !== '/login', { timeout: 15_000 });

    const statePath = path.join(authDir, role.file);
    await context.storageState({ path: statePath });
    await context.close();

    console.log(`[global-setup] Saved auth state for ${role.username} → ${statePath}`);
  }

  await browser.close();
}
