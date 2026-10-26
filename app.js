'use strict';
const DEMO_SPECS = ['webauthn-3', 'digital-credentials', 'vibration'];
const ANGLES = {
  time: 'Standards take years. Support here needs to outlast a single grant.',
  editors: 'More editors and perspectives strengthen a spec. Could you fund someone to join?',
  review: "Horizontal review needs reviewers. 'No request found' may be a gap support could fill, or the review may have happened elsewhere.",
  maintenance: 'Open issues are entry points for funded contributors.'
};
const cards = new Map();
const responses = Object.create(null);
let demoCachePromise;
let githubToken = '';
try { githubToken = sessionStorage.getItem('github-token') || ''; } catch { /* Session storage can be unavailable in private contexts. */ }
const tokenInput = document.querySelector('#github-token');
tokenInput.value = githubToken;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, url, className) {
  const node = element('a', className, text);
  try { const parsed = new URL(url); if (parsed.protocol === 'https:') node.href = parsed.href; } catch { /* Ignore invalid external links. */ }
  return node;
}
class HTTPError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}
async function fetchJSON(url, headers, provenance = new Set()) {
  try {
    const response = await fetch(url, headers ? { headers } : undefined);
    if (!response.ok) throw new HTTPError(response.status);
    if (response.status === 202) return null;
    const body = await response.json();
    responses[url] = body;
    return body;
  } catch (error) {
    if (error.status === 404) throw error;
    demoCachePromise ||= fetch(new URL('demo-cache.json', document.baseURI)).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const cache = await demoCachePromise;
    if (Object.hasOwn(cache, url)) {
      provenance.add(cache._generated ? String(cache._generated).slice(0, 10) : 'date unavailable');
      return cache[url];
    }
    throw error;
  }
}
function renderSection(card, key, content) {
  const section = card.sections[key];
  section.body.replaceChildren(...content);
  section.note.textContent = card.provenance[key].size ? `cached ${[...card.provenance[key]].join(', ')}` : '';
}
function sectionFailure(card, key, error) {
  console.error(card.shortname, key, error);
  const detail = key === 'review' && error.status === 403 ? "couldn't load (rate limit; add a token)" : "couldn't load";
  renderSection(card, key, [element('p', 'load-error', detail)]);
}
function makeCard(shortname) {
  const node = element('article', 'card');
  const header = element('header', 'card-header');
  const title = element('h2', '', shortname);
  const remove = element('button', 'remove-button', 'Remove');
  remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${shortname}`);
  remove.addEventListener('click', () => { cards.delete(shortname); node.remove(); renderTimelines(); });
  header.append(title, link(shortname, `https://www.w3.org/TR/${shortname}/`, 'spec-link'), remove);
  node.append(header);
  const card = { shortname, node, title, sections: {}, provenance: {}, first: null };
  for (const [key, heading] of Object.entries({ time: 'Time in process', editors: 'Editors', review: 'Review', maintenance: 'Maintenance' })) {
    const section = element('section', 'card-section');
    const body = element('div', `section-body ${key}-body`);
    body.append(element('p', 'loading', 'loading…'));
    const note = element('p', 'cached-note');
    section.append(element('h3', '', heading), body, element('p', 'angle', ANGLES[key]), note);
    node.append(section); card.sections[key] = { section, body, note }; card.provenance[key] = new Set();
  }
  card.footer = element('footer', 'card-footer');
  card.footer.append(link('Implementations', `https://webstatus.dev/?q=${encodeURIComponent(shortname)}`));
  node.append(card.footer);
  return card;
}
function renderTimelines() { /* Shared publication axis is added in the next build checkpoint. */ }
async function addCard(shortname) {
  shortname = shortname.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(shortname)) return;
  if (cards.has(shortname)) { document.querySelector('#page-message').textContent = `${shortname} is already on the page.`; return; }
  document.querySelector('#page-message').textContent = '';
  const card = makeCard(shortname); cards.set(shortname, card); document.querySelector('#cards').append(card.node);
  try {
    card.spec = await fetchJSON(`https://api.w3.org/specifications/${encodeURIComponent(shortname)}`, undefined, card.provenance.time);
    card.title.textContent = card.spec.title;
    for (const key of Object.keys(card.sections)) renderSection(card, key, [element('p', 'loading', 'loading…')]);
  } catch (error) {
    console.error(shortname, 'specification', error);
    for (const section of Object.values(card.sections)) section.section.remove();
    card.node.insertBefore(element('p', 'load-error', error.status === 404 ? `couldn't find ${shortname}` : "couldn't load specification"), card.footer);
  }
}
document.querySelector('#add-spec').addEventListener('submit', event => {
  event.preventDefault(); const input = document.querySelector('#shortname'); addCard(input.value); input.value = '';
});
tokenInput.addEventListener('change', () => {
  githubToken = tokenInput.value.trim();
  try { if (githubToken) sessionStorage.setItem('github-token', githubToken); else sessionStorage.removeItem('github-token'); } catch { /* Memory remains available. */ }
});
document.querySelector('#export-cache').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ _generated: new Date().toISOString(), ...responses }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const download = document.createElement('a');
  download.href = url; download.download = 'demo-cache.json'; download.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
DEMO_SPECS.forEach(addCard);
