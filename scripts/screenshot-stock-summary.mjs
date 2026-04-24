/**
 * Captures "before/after" screenshots of the Stock Summary section
 * on the daily report for April 5 and April 2, 2026.
 *
 * Usage:
 *   node scripts/screenshot-stock-summary.mjs [before|after]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:3001';
// Test server (port 3001) uses mock API — real report data is at /admin/report
const USERNAME  = 'admin';
const PASSWORD  = 'Kedco@2026!';
const LABEL     = process.argv[2] ?? 'before';
const OUT_DIR   = `/root/projects/website/screenshots/stock-summary`;

mkdirSync(OUT_DIR, { recursive: true });

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"], input[name="username"]', USERNAME);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
}

async function screenshotDate(page, dateStr) {
  await page.goto(`${BASE_URL}/admin/report?date=${dateStr}`, { waitUntil: 'networkidle' });

  // Wait for Stock Summary card
  try {
    await page.waitForSelector('text=Stock Summary', { timeout: 8000 });
  } catch {
    console.warn(`  ⚠  Stock Summary not found on ${dateStr} — screenshotting full page`);
    await page.screenshot({ path: `${OUT_DIR}/${LABEL}-${dateStr}-fullpage.png`, fullPage: true });
    return;
  }

  // Screenshot the full page so we can see the Stock Summary card in context
  await page.screenshot({ path: `${OUT_DIR}/${LABEL}-${dateStr}-fullpage.png`, fullPage: true });
  console.log(`  ✓  ${OUT_DIR}/${LABEL}-${dateStr}-fullpage.png`);

  // Print key rows as text for quick verification
  const rows = await page.locator('text=Stock Summary').locator('../..').innerText().catch(() => '');
  const lines = rows.split('\n').map(l => l.trim()).filter(Boolean);
  const jpy = lines.find(l => l.includes('JPY')) ?? '(no JPY)';
  const usd = lines.find(l => l.includes('USD')) ?? '(no USD)';
  console.log(`     JPY: ${jpy}`);
  console.log(`     USD: ${usd}`);
}

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log(`\n📸  Stock Summary screenshots [${LABEL}]\n`);

  await login(page);
  console.log('  ✓  Logged in\n');

  console.log('→ April 5, 2026 (reference — known-good seed):');
  await screenshotDate(page, '2026-04-05');

  console.log('\n→ April 2, 2026 (JPY should show 0.371 before fix / 0.3707 after):');
  await screenshotDate(page, '2026-04-02');

  await browser.close();
  console.log('\nDone. Screenshots in:', OUT_DIR);
})();
