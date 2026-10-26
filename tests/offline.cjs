// Exercise the real service worker and browser offline mode after one online visit.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'demo-cache.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://**/*', route => route.fulfill(Object.hasOwn(fixture, route.request().url()) ? { json: fixture[route.request().url()] } : { status: 404, json: {} }));
    await page.goto(process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:8080');
    await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 45000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.unroute('https://**/*');
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 3 && !document.querySelector('.loading'), null, { timeout: 45000 });
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.equal(await page.locator('.cached-note').filter({ hasText: 'cached' }).count(), 12);
    assert.equal(await page.locator('.editor-item').count(), 10);
    assert.equal(await page.locator('.commit-strip > g').count(), 156);
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 1080));
    assert.deepEqual(pageErrors, []);
    console.log('PASS real offline reload: app shell, 3 cards, 12 cache labels, 10 editors, 156 weeks');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
