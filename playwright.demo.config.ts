/**
 * Playwright config for recording the demo walkthrough video.
 *
 * Run:  npx playwright test --config=playwright.demo.config.ts
 *
 * Output: test-results/demo-walkthrough-chromium/video.webm
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/demo',
  timeout: 600_000,    // 10 min — recording, not a CI gate
  retries: 0,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/setup/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3001',
    viewport: { width: 1280, height: 800 },
    video: 'on',
    // Slow everything down so the video looks human, not robotic
    actionTimeout: 30_000,
    launchOptions: { slowMo: 300 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: [
    {
      command: 'node tests/setup/mock-api.mjs',
      port: 9999,
      reuseExistingServer: true,
    },
    {
      // Run `API_URL=http://localhost:9999 npx next build` once before re-recording.
      // This just starts the pre-built output.
      command: 'API_URL=http://localhost:9999 AUTH_COOKIE=kedco_token npx next start --port 3001',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
