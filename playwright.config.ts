import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/setup/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    // 1. Mock FastAPI — starts first so it's ready when Next.js boots
    {
      command: 'node tests/setup/mock-api.mjs',
      port: 9999,
      reuseExistingServer: !process.env.CI,
    },
    // 2. Next.js on port 3001 (separate from normal dev on 3000) pointed at mock API
    {
      command: 'npx next dev --port 3001',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        API_URL:     'http://localhost:9999',
        AUTH_COOKIE: 'kedco_token',
      },
    },
  ],
});
