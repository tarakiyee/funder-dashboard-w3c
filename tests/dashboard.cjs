// Browser regression checks against recorded public API responses, with deliberate failures.
// Run with Playwright installed outside the repository; see TESTING.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:8080';
const fixturePath = process.env.DASHBOARD_FIXTURES || path.join(__dirname, '..', 'demo-cache.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const specURL = name => `https://api.w3.org/specifications/${name}`;
const demoNames = ['webauthn-3', 'digital-credentials', 'vibration'];
const checks = [];
let browser;
async function scenario(name, fn) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  let override = () => null;
  let fallback = {};
  await page.route('**/demo-cache.json', route => route.fulfill({ json: fallback }));
  await page.route('https://**/*', async route => {
    const req = route.request();
    requests.push({ url: req.url(), headers: req.headers() });
    const changed = await override(route);
    if (changed) return;
    if (Object.hasOwn(fixture, req.url())) return route.fulfill({ json: fixture[req.url()] });
    return route.fulfill({ status: 404, json: { message: 'Not found' } });
  });
  try {
    await fn({ page, requests, setOverride: fn => { override = fn; }, setFallback: value => { fallback = value; } });
    assert.deepEqual(errors, [], 'No unhandled browser errors');
    checks.push(name);
    console.log(`PASS ${name}`);
  } finally { await page.close(); }
}
async function settled(page) {
  await page.waitForFunction(() => document.querySelectorAll('.card').length > 0 && !document.querySelector('.loading'), null, { timeout: 45000 });
}
async function open(page) { await page.goto(base); await settled(page); }
async function add(page, name) { await page.locator('#shortname').fill(name); await page.locator('#shortname').press('Enter'); }
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  await scenario('demo facts, shared axis, colour identity, projector and narrow layouts', async ({ page }) => {
    await open(page);
    assert.equal(await page.locator('.card').count(), 3);
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.deepEqual(await page.locator('.time-body .fact').allTextContents(), [
      'REC · first published 2021-04-27 · 5 years in process',
      'WD · first published 2025-07-01 · 1 year in process',
      'CRD · first published 2011-11-17 · 14 years in process'
    ]);
    assert.deepEqual(await page.locator('.editors-body .fact').allTextContents(), ['6 editors from 5 organisations', '3 editors from 3 organisations', '1 editor from 1 organisation']);
    assert.equal(await page.locator('.review-row').count(), 15);
    assert.equal(await page.locator('.commit-strip > g').count(), 156);
    const axes = await page.locator('.timeline').evaluateAll(svgs => svgs.map(svg => [...svg.querySelectorAll('.axis-label')].map(label => [label.textContent, label.getAttribute('x')])));
    assert.deepEqual(axes[0], axes[1]); assert.deepEqual(axes[1], axes[2]);
    const colours = await page.locator('.legend-entry').evaluateAll(entries => entries.map(e => [e.textContent, getComputedStyle(e.firstChild).backgroundColor]));
    const organisations = new Map();
    for (const [name, colour] of colours) { if (organisations.has(name)) assert.equal(organisations.get(name), colour); organisations.set(name, colour); }
    const bounds = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('.card')].map(c => c.getBoundingClientRect().height) }));
    assert.ok(bounds.height <= 1080, JSON.stringify(bounds)); assert.ok(bounds.width <= 1920, JSON.stringify(bounds));
    assert.ok(bounds.cards.every(height => height <= 850), JSON.stringify(bounds));
    assert.equal(await page.locator('.angle').count(), 12);
    await page.getByRole('button', { name: 'Remove vibration', exact: true }).click();
    const changed = await page.locator('.timeline').evaluateAll(svgs => svgs.map(svg => svg.querySelector('.axis-label').textContent));
    assert.deepEqual(changed, ['2021', '2021']);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  });
  await scenario('canonical aliases, deduplication and card removal', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (route.request().url() !== specURL('svg2')) return false;
      await route.fulfill({ json: { ...fixture[specURL('webauthn-3')], shortname: 'SVG2', title: 'Scalable Vector Graphics (SVG) 2' } }); return true;
    });
    await open(page);
    await add(page, 'WebAuthn-3'); assert.equal(await page.locator('.card').count(), 3);
    await add(page, 'svg2'); await settled(page);
    assert.equal(await page.locator('.card').count(), 4);
    assert.equal(await page.locator('.spec-link').last().getAttribute('href'), 'https://www.w3.org/TR/SVG2/');
    await add(page, 'SVG2'); assert.equal(await page.locator('.card').count(), 4);
    await page.getByRole('button', { name: 'Remove SVG2', exact: true }).click();
    assert.equal(await page.locator('.card').count(), 3);
  });
  await scenario('a 404 gates the card and never uses fallback', async ({ page, setFallback }) => {
    setFallback({ ...fixture, [specURL('not-a-real-spec')]: fixture[specURL('webauthn-3')] });
    await open(page); await add(page, 'not-a-real-spec'); await settled(page);
    const unknown = page.locator('.card').last();
    assert.match(await unknown.innerText(), /couldn't find not-a-real-spec/);
    assert.equal(await unknown.locator('.card-section').count(), 0);
  });
  await scenario('editor failures leave publications, review and maintenance intact', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().endsWith('/20260825/editors')) return false;
      await route.fulfill({ status: 503, json: {} }); return true;
    });
    await open(page);
    const card = page.locator('.card').first();
    assert.match(await card.locator('.editors-body').innerText(), /couldn't load/);
    assert.equal(await card.locator('.time-body .fact').count(), 1);
    assert.equal(await card.locator('.review-row').count(), 5);
    assert.equal(await card.locator('.commit-strip > g').count(), 52);
  });
  await scenario('search 403 gives actionable text and preserves other sections', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().includes('/search/issues?')) return false;
      await route.fulfill({ status: 403, json: {} }); return true;
    });
    await open(page);
    for (const text of await page.locator('.review-body').allTextContents()) assert.equal(text, "couldn't load (rate limit; add a token)");
    assert.equal(await page.locator('.editor-item').count(), 10);
  });
  await scenario('commit activity retries 202 and non-array responses before rendering', async ({ page, setOverride }) => {
    const attempts = new Map();
    setOverride(async route => {
      const url = route.request().url(); if (!url.endsWith('/stats/commit_activity')) return false;
      const count = (attempts.get(url) || 0) + 1; attempts.set(url, count);
      if (count === 1) { await route.fulfill({ status: 202, body: '' }); return true; }
      if (count === 2) { await route.fulfill({ json: {} }); return true; }
      return false;
    });
    await open(page); assert.equal(await page.locator('.commit-strip > g').count(), 156);
    assert.ok([...attempts.values()].every(count => count === 3));
  });
  await scenario('unavailable APIs use labelled fallback and the cards still fit', async ({ page, setOverride, setFallback }) => {
    setFallback(fixture);
    setOverride(async route => { await route.abort('internetdisconnected'); return true; });
    await open(page);
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.equal(await page.locator('.cached-note').filter({ hasText: 'cached' }).count(), 12);
    assert.equal(await page.locator('.editor-item').count(), 10);
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 1080));
    assert.ok(await page.locator('.card').evaluateAll(cs => cs.every(c => c.getBoundingClientRect().height <= 850)));
  });
  await scenario('token survives reload in session only and is excluded from exported cache', async ({ page, requests }) => {
    await open(page);
    const token = 'test-token-not-a-real-credential';
    await page.locator('#github-token').fill(token); await page.locator('#shortname').focus();
    await settled(page);
    assert.ok(requests.some(req => req.url.startsWith('https://api.github.com/') && req.headers.authorization === `Bearer ${token}`));
    assert.ok(requests.filter(req => req.url.startsWith('https://api.w3.org/')).every(req => !req.headers.authorization));
    assert.ok(requests.every(req => !req.url.includes(token)));
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await page.reload(); await settled(page);
    assert.equal(await page.locator('#github-token').inputValue(), token);
    const downloadEvent = page.waitForEvent('download'); await page.locator('#export-cache').click();
    const download = await downloadEvent;
    const exported = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(!exported.includes(token));
    assert.ok(JSON.parse(exported)._generated);
    assert.ok(Object.keys(JSON.parse(exported)).every(key => key === '_generated' || key.startsWith('https://')));
    await page.locator('#github-token').fill(''); await page.locator('#shortname').focus();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('github-token')), null);
  });
  console.log(`${checks.length} browser scenarios passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
