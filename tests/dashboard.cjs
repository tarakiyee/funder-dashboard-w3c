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
const demoNames = ['battery-status', 'payment-request', 'webauthn-3'];
const checks = [];
let browser;
let scenarioSequence = 0;
async function scenario(name, fn, contextOptions = {}) {
  const sequence = scenarioSequence++;
  if (process.env.DASHBOARD_TEST_GROUP !== undefined && sequence % Number(process.env.DASHBOARD_TEST_GROUPS || 3) !== Number(process.env.DASHBOARD_TEST_GROUP)) return;
  if (process.env.DASHBOARD_TEST_CASE && !name.includes(process.env.DASHBOARD_TEST_CASE)) return;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block', ...contextOptions });
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
  await page.waitForFunction(() => document.querySelectorAll('.card').length > 0 && !document.querySelector('.loading') && !document.querySelector('.card[aria-busy="true"]'), null, { timeout: 45000 });
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
      'WD · first published 2011-04-26 · 15 years in process',
      'CRD · first published 2016-04-21 · 10 years in process',
      'REC · first published 2021-04-27 · 5 years in process · Level 3 · series since 2016'
    ]);
    assert.deepEqual(await page.locator('.editors-body .fact').allTextContents(), ['1 editor from 1 organisation', '3 editors from 3 organisations', '6 editors from 5 organisations']);
    assert.equal(await page.locator('.review-row').count(), 15);
    assert.deepEqual(await page.locator('.timeline').evaluateAll(svgs => svgs.map(svg => svg.querySelectorAll('.publication-circle').length)), [2, 2, 6]);
    assert.ok(await page.locator('.timeline').evaluateAll(svgs => svgs.every(svg => svg.querySelectorAll('.latest-review').length <= 5)));
    assert.equal(await page.locator('.card').nth(2).locator('.review-tick').count(), 9);
    assert.ok(await page.locator('.card *').evaluateAll(nodes => nodes.filter(node => !node.closest('svg') && !node.matches('.review-caveat')).every(node => parseFloat(getComputedStyle(node).fontSize) >= 14)));
    await page.locator('#shortname').fill('SVG2');
    assert.ok(await page.locator('#shortname').evaluate(input => input.checkValidity()));
    await page.locator('#shortname').fill('');
    assert.equal(await page.locator('.commit-strip > g').count(), 156);
    assert.deepEqual(await page.locator('.entry-points-block .review-open-issues').allTextContents(), ['2 open from horizontal review', '3 open from horizontal review', '4 open from horizontal review']);
    const axes = await page.locator('.context-strip').evaluateAll(svgs => svgs.map(svg => [...svg.querySelectorAll('.axis-label')].map(label => [label.textContent, label.getAttribute('x')])));
    assert.deepEqual(axes[0], axes[1]); assert.deepEqual(axes[1], axes[2]);
    const detailStarts = await page.locator('.timeline').evaluateAll(svgs => svgs.map(svg => svg.querySelector('.axis-label').textContent));
    assert.deepEqual(detailStarts, ['2011', '2016', '2021']);
    assert.equal(await page.locator('.review-body .review-open-issues').count(), 0);
    const colours = await page.locator('.legend-entry').evaluateAll(entries => entries.map(e => [e.textContent, getComputedStyle(e.firstChild).backgroundColor]));
    const organisations = new Map();
    for (const [name, colour] of colours) { if (organisations.has(name)) assert.equal(organisations.get(name), colour); organisations.set(name, colour); }
    const bounds = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('.card')].map(c => c.getBoundingClientRect().height) }));
    assert.ok(bounds.height <= 1080, JSON.stringify(bounds)); assert.ok(bounds.width <= 1920, JSON.stringify(bounds));
    assert.ok(bounds.cards.every(height => height <= 850), JSON.stringify(bounds));
    assert.equal(await page.locator('.angle').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'What the funder guide says' }).count(), 12);
    await page.getByRole('button', { name: 'Remove battery-status', exact: true }).click();
    const changed = await page.locator('.context-strip').evaluateAll(svgs => svgs.map(svg => svg.querySelector('.axis-label').textContent));
    assert.deepEqual(changed, ['shared scale · 2016', 'shared scale · 2016']);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  });
  await scenario('help popovers support hover, focus, touch-style clicks and Escape without overflow', async ({ page }) => {
    await open(page);
    const buttons = page.getByRole('button', { name: 'What the funder guide says' });
    assert.equal(await page.locator('.help-popover:visible').count(), 0);
    await buttons.nth(0).hover();
    assert.equal(await page.locator('.help-popover:visible').count(), 1);
    assert.equal(await page.locator('.help-popover:visible').innerText(), 'Standards decisions affect digital infrastructure for decades. Meaningful participation requires sustained engagement, and maintenance needs funding, not just initial development.');
    await buttons.nth(1).focus();
    assert.equal(await page.locator('.help-popover:visible').count(), 1);
    assert.equal(await buttons.nth(0).getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.help-popover:visible').count(), 0);
    await buttons.nth(2).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.help-popover:visible').count(), 0);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.help-popover:visible').count(), 1);
    assert.ok((await page.locator('.help-popover:visible').innerText()).endsWith('Fund independent impact assessments.'));
    await page.keyboard.press('Escape');
    await page.locator('#shortname').focus();
    await buttons.nth(2).tap(); assert.equal(await page.locator('.help-popover:visible').count(), 1);
    await buttons.nth(2).tap(); assert.equal(await page.locator('.help-popover:visible').count(), 0);
    await page.locator('#shortname').focus();
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await buttons.nth(2).focus();
    const bounds = await page.locator('.help-popover:visible').evaluate(node => {
      const popover = node.getBoundingClientRect(), card = node.closest('.card').getBoundingClientRect();
      return { left: popover.left, right: popover.right, width: popover.width, bottom: popover.bottom, cardLeft: card.left, cardRight: card.right, cardBottom: card.bottom };
    });
    assert.ok(bounds.width <= 340 && bounds.left >= bounds.cardLeft && bounds.right <= bounds.cardRight && bounds.bottom <= bounds.cardBottom, JSON.stringify(bounds));
    await page.locator('#shortname').click(); assert.equal(await page.locator('.help-popover:visible').count(), 0);
  }, { hasTouch: true });
  await scenario('series chronology and level-aware review matching', async ({ page }) => {
    await open(page);
    assert.match(await page.locator('.time-body').nth(2).innerText(), /Level 3 · series since 2016/);
    assert.doesNotMatch(await page.locator('.time-body').nth(2).innerText(), /series since 2019/);
    const matches = await page.evaluate(() => [
      belongsToLevel('Web Authentication Level 2', '3'),
      belongsToLevel('Web Authentication L2', '3'),
      belongsToLevel('Web Authentication Level 3', '3'),
      belongsToLevel('Web Authentication v2', '3'),
      belongsToLevel('Web Authentication 3', '3'),
      belongsToLevel('Web Authentication v3.0', '3'),
      belongsToLevel('Web Authentication 2025-04-24 > 2025-05-25', '3'),
      belongsToLevel('Web Authentication Level 3 2025-02-19 > 2025-03-31', '3'),
      belongsToLevel('A review with no version named', '3'),
      belongsToLevel('Level 2', undefined)
    ]);
    assert.deepEqual(matches, [false, false, true, false, true, true, true, true, true, true]);
    for (const text of await page.locator('.maintenance-figure').allTextContents()) assert.match(text, /series repository/);
  });
  await scenario('honesty labels, visible editor names and implementation search URLs', async ({ page }) => {
    await open(page);
    assert.equal(await page.getByLabel('GitHub token (optional, kept in this tab)', { exact: true }).count(), 1);
    assert.deepEqual(await page.getByRole('link', { name: 'Search implementations', exact: true }).evaluateAll(links => links.map(link => link.href)), [
      'https://webstatus.dev/?q=Battery%20Status%20API',
      'https://webstatus.dev/?q=Payment%20Request%20API',
      'https://webstatus.dev/?q=Web%20Authentication'
    ]);
    assert.ok((await page.locator('.editor-name').allTextContents()).includes('Pascoe'));
    assert.deepEqual(await page.evaluate(() => [cleanEditorName('\u3164 Pascoe'), cleanEditorName('\u200bA\ufeff'), cleanEditorName('François 李')]), ['Pascoe', 'A', 'François 李']);
  });
  await scenario('implementation search falls back to the shortname when the index has no entry', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().includes('web-specs@latest/index.json')) return false;
      await route.fulfill({ json: [] }); return true;
    });
    await open(page);
    assert.deepEqual(await page.getByRole('link', { name: 'Search implementations', exact: true }).evaluateAll(links => links.map(link => link.href)), demoNames.map(name => `https://webstatus.dev/?q=${name}`));
  });
  await scenario('walkthrough steps, summaries, controls and closing preserve the layout', async ({ page }) => {
    await open(page);
    const layout = () => page.locator('.card').evaluateAll(cards => cards.map(card => { const r = card.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
    const before = await layout();
    await page.getByRole('button', { name: 'Walk through', exact: true }).click();
    assert.equal(await page.locator('#walkthrough-banner:visible').count(), 1);
    assert.equal(await page.locator('.walkthrough-highlight').count(), 3);
    assert.match(await page.locator('#walkthrough-guide').innerText(), /^Standards decisions affect/);
    assert.match(await page.locator('#walkthrough-fact').innerText(), /Battery Status API — WD/);
    assert.equal(await page.locator('.editors-body').first().evaluate(node => getComputedStyle(node.parentElement).opacity), '0.6');
    await page.keyboard.press('ArrowRight'); assert.match(await page.locator('#walkthrough-guide').innerText(), /^Fund time for people/);
    assert.match(await page.locator('#walkthrough-fact').innerText(), /1 editor from 1 organisation/);
    await page.locator('#walkthrough-guide').click(); assert.match(await page.locator('#walkthrough-guide').innerText(), /^Accessibility, internationalization/);
    await page.keyboard.press('ArrowRight'); assert.match(await page.locator('#walkthrough-guide').innerText(), /^Maintenance means/);
    await page.keyboard.press('ArrowLeft'); assert.match(await page.locator('#walkthrough-guide').innerText(), /^Accessibility, internationalization/);
    await page.locator('#walkthrough-next').click(); await page.locator('#walkthrough-next').click();
    assert.equal(await page.locator('#walkthrough-guide').innerText(), 'Same data, same sources. The difference is what a funder can act on.');
    assert.equal(await page.locator('.walkthrough-highlight').count(), 0);
    await page.keyboard.press('ArrowLeft'); assert.match(await page.locator('#walkthrough-guide').innerText(), /^Maintenance means/);
    assert.deepEqual(await layout(), before);
    assert.ok(await page.evaluate(() => scrollY === 0 && document.documentElement.scrollHeight <= 1080));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#walkthrough-banner:visible').count(), 0);
    assert.equal(await page.locator('body.walkthrough-active').count(), 0);
    await page.getByRole('button', { name: 'Walk through', exact: true }).click();
    await page.locator('#walkthrough-done').click(); assert.equal(await page.locator('#walkthrough-banner:visible').count(), 0);
    assert.equal(await page.locator('#walk-through').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await layout(), before);
  });
  await scenario('patents links use W3C delivering-group IPR URLs', async ({ page }) => {
    await open(page);
    assert.deepEqual(await page.locator('.patent-link').evaluateAll(links => links.map(a => a.href)), demoNames.map(name => {
      const latest = fixture[fixture[specURL(name)]._links['latest-version'].href];
      const group = fixture[fixture[latest._links.deliverers.href]._links.deliverers[0].href];
      return group._links['pp-status'].href;
    }));
    assert.match(await page.locator('.patent-link').first().getAttribute('href'), /\/groups\/wg\/das\/ipr/);
  });
  await scenario('patents fallback is used only when the group API fails', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().endsWith('/deliverers')) return false;
      await route.fulfill({ status: 503, json: {} }); return true;
    });
    await open(page);
    assert.equal(await page.locator('.patent-link').first().getAttribute('href'), 'https://www.w3.org/das/ipr/');
  });
  await scenario('shortname suggestions resolve titles and familiar series names', async ({ page }) => {
    await open(page);
    const expected = fixture['https://cdn.jsdelivr.net/npm/web-specs@latest/index.json'].filter(entry => entry.organization === 'W3C');
    assert.equal(await page.locator('#spec-shortnames option').count(), expected.length);
    assert.equal(await page.locator('#shortname').getAttribute('list'), 'spec-shortnames');
    assert.deepEqual(await page.evaluate(() => ['WebAuthn', 'Battery Status', 'Payment Request', 'BATTERY-STATUS'].map(resolveShortname)), ['webauthn-3', 'battery-status', 'payment-request', 'battery-status']);
    await add(page, 'Battery Status');
    await page.waitForFunction(() => document.querySelector('#page-message').textContent.includes('already on the page'));
    assert.equal(await page.locator('.card').count(), 3);
    await add(page, 'bad!name');
    await page.waitForFunction(() => document.querySelector('#page-message').textContent.includes('suggestions'));
    assert.equal(await page.locator('.card').count(), 3);
  });
  await scenario('loading skeletons reserve space and reveal after the eight-second cap', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().endsWith('/editors')) return false;
      await new Promise(resolve => setTimeout(resolve, 9000));
      await route.fulfill({ json: fixture[route.request().url()] }); return true;
    });
    await page.goto(base);
    assert.equal(await page.locator('.card.pending').count(), 3);
    assert.equal(await page.locator('.skeleton-placeholder').count(), 12);
    const initial = await page.locator('.card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
    await page.waitForFunction(() => !document.querySelector('.card.pending'), null, { timeout: 9000 });
    assert.ok(await page.locator('.loading').count() > 0);
    await settled(page);
    assert.deepEqual(await page.locator('.card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height)), initial);
  });
  await scenario('accessible timeline lists include the publications, review requests and last commit', async ({ page }) => {
    await open(page);
    const data = await page.evaluate(() => [...cards.values()].map(card => ({
      contextList: card.timelineHost.querySelector('.context-strip').nextElementSibling.tagName,
      detailList: card.timelineHost.querySelector('.timeline').nextElementSibling.tagName,
      contextLabel: card.timelineHost.querySelector('.context-strip').getAttribute('aria-label'),
      detailLabel: card.timelineHost.querySelector('.timeline').getAttribute('aria-label'),
      text: [...card.timelineHost.querySelector('.timeline').nextElementSibling.children].map(li => li.textContent),
      publications: card.versionDates,
      reviews: card.reviews.map(item => `${REVIEW_AREAS.find(area => item.repository_url.endsWith('/' + area.repo)).label}, #${item.number}, ${item.state}, ${dateOnly(item.created_at)}`),
      lastCommit: dateOnly(card.lastCommit.date)
    })));
    for (const card of data) {
      assert.equal(card.contextList, 'UL'); assert.equal(card.detailList, 'UL');
      assert.ok(card.contextLabel && card.detailLabel);
      for (const date of card.publications) assert.ok(card.text.includes(`Publication ${date}`));
      for (const review of card.reviews) assert.ok(card.text.includes(review));
      assert.ok(card.text.includes(`Last commit ${card.lastCommit}`));
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 1080));
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
    const card = page.locator('.card').nth(2);
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
  await scenario('cold commit activity keeps other figures visible and succeeds on attempt eight', async ({ page, setOverride }) => {
    const attempts = new Map();
    setOverride(async route => {
      const url = route.request().url(); if (!url.endsWith('/stats/commit_activity')) return false;
      const count = (attempts.get(url) || 0) + 1; attempts.set(url, count);
      if (count < 8) { await route.fulfill({ status: 202, body: '' }); return true; }
      return false;
    });
    await page.goto(base);
    await page.waitForSelector('.entry-points-block .maintenance-figure a');
    await page.waitForFunction(() => [...document.querySelectorAll('.activity-block .loading')].some(e => e.textContent === 'GitHub is computing commit activity…'));
    await settled(page);
    assert.equal(await page.locator('.commit-strip > g').count(), 156);
    assert.ok([...attempts.values()].every(count => count === 8));
  });
  await scenario('cold commit activity stops after eight attempts without blanking other data', async ({ page, setOverride }) => {
    const attempts = new Map();
    setOverride(async route => {
      const url = route.request().url(); if (!url.endsWith('/stats/commit_activity')) return false;
      attempts.set(url, (attempts.get(url) || 0) + 1);
      await route.fulfill({ status: 202, body: '' }); return true;
    });
    await open(page);
    assert.ok([...attempts.values()].every(count => count === 8));
    assert.equal(await page.locator('.activity-block .load-error').count(), 3);
    assert.equal(await page.locator('.entry-points-block .maintenance-figure a').count(), 3);
    assert.equal(await page.locator('.last-commit a').count(), 3);
    assert.equal(await page.locator('.review-row').count(), 15);
  });
  await scenario('zero horizontal-review issues render plainly in Entry points', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().includes('/search/issues?per_page=1&')) return false;
      await route.fulfill({ json: { total_count: 0, items: [] } }); return true;
    });
    await open(page);
    assert.deepEqual(await page.locator('.entry-points-block .review-open-issues').allTextContents(), Array(3).fill('0 open from horizontal review'));
    assert.equal(await page.locator('.review-row').count(), 15);
  });
  await scenario('repository review-count failure leaves activity and horizontal request rows intact', async ({ page, setOverride }) => {
    setOverride(async route => {
      if (!route.request().url().includes('/search/issues?per_page=1&')) return false;
      await route.fulfill({ status: 503, json: {} }); return true;
    });
    await open(page);
    assert.equal(await page.locator('.entry-points-block .load-error').count(), 3);
    assert.equal(await page.locator('.commit-strip > g').count(), 156);
    assert.equal(await page.locator('.review-row').count(), 15);
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
