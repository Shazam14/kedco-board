/**
 * Auth & routing tests — the most critical tests.
 * Verifies that each role lands on the correct screen after login,
 * and that unauthenticated/wrong-role access redirects correctly.
 *
 * These tests need NO prior auth state — they log in fresh each time.
 */

import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('SIGN IN TO DASHBOARD')).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /SIGN IN/ })).toBeVisible();
  });

  test('shows error on unknown user', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'nobody');
    await page.fill('input[autocomplete="current-password"]', 'wrong');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Invalid username or password/i)).toBeVisible();
  });
});

test.describe('Role-based redirects after login', () => {
  async function loginAs(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never, username: string) {
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', username);
    await page.fill('input[autocomplete="current-password"]', username);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  }

  test('admin → /dashboard', async ({ page }) => {
    await loginAs(page, 'admin');
    expect(page.url()).toContain('/dashboard');
  });

  test('supervisor → /counter', async ({ page }) => {
    await loginAs(page, 'supervisor1');
    expect(page.url()).toContain('/counter');
  });

  test('cashier → /counter', async ({ page }) => {
    await loginAs(page, 'cashier1');
    expect(page.url()).toContain('/counter');
  });

  test('rider → /rider', async ({ page }) => {
    await loginAs(page, 'rider01');
    expect(page.url()).toContain('/rider');
  });
});

test.describe('Unauthenticated access is blocked', () => {
  test('/counter → redirects to /login', async ({ page }) => {
    await page.goto('/counter');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('/dashboard → redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('/rider → redirects to /login', async ({ page }) => {
    await page.goto('/rider');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });
});

test.describe('Wrong-role access is redirected', () => {
  test('cashier accessing /dashboard → redirected to /counter', async ({ page }) => {
    // Log in as cashier
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'cashier1');
    await page.fill('input[autocomplete="current-password"]', 'cashier1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/counter');

    // Now try to navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard'), { timeout: 10_000 });
    expect(page.url()).toContain('/counter');
  });

  test('rider accessing /dashboard → redirected to /rider', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autocomplete="username"]', 'rider01');
    await page.fill('input[autocomplete="current-password"]', 'rider01');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/rider');

    await page.goto('/dashboard');
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard'), { timeout: 10_000 });
    expect(page.url()).toContain('/rider');
  });
});
