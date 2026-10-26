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
const STATUS = {
  'First Public Working Draft': 'WD', 'Working Draft': 'WD',
  'Candidate Recommendation Snapshot': 'CR', 'Candidate Recommendation Draft': 'CRD',
  'Recommendation': 'REC', 'Group Note': 'Note', 'Note': 'Note', 'Draft Note': 'Note'
};
const today = new Date();
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function markTitle(node, text) { node.append(svgElement('title', {}, text)); return node; }
function parseDate(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error('Invalid date in response');
  return date;
}
function dateOnly(value) { return parseDate(value).toISOString().slice(0, 10); }
function wholeYears(value) {
  const first = parseDate(value);
  let years = today.getUTCFullYear() - first.getUTCFullYear();
  if (today.getUTCMonth() < first.getUTCMonth() || (today.getUTCMonth() === first.getUTCMonth() && today.getUTCDate() < first.getUTCDate())) years--;
  return Math.max(0, years);
}
function timeline(card, start) {
  const width = 540, height = 158, left = 18, right = 488;
  const end = today.getTime();
  const x = value => left + (parseDate(value).getTime() - start) / Math.max(1, end - start) * (right - left);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, class: 'timeline', role: 'img', 'aria-label': `Publication, review and commit timeline from ${new Date(start).getUTCFullYear()} to today` });
  const label = (text, px, py, anchor = 'start', cls = '') => svg.append(svgElement('text', { x: px, y: py, 'text-anchor': anchor, class: cls }, text));
  const years = today.getUTCFullYear() - new Date(start).getUTCFullYear();
  const step = years > 12 ? 3 : years > 6 ? 2 : 1;
  for (let year = new Date(start).getUTCFullYear(); year <= today.getUTCFullYear(); year += step) {
    const px = x(`${year}-01-01`);
    svg.append(svgElement('line', { x1: px, x2: px, y1: 22, y2: 133, stroke: 'var(--grid)' }));
    // Keep the final year label clear of "today".
    if (right - px > 36) label(String(year), px, 151, 'middle', 'axis-label');
  }
  svg.append(svgElement('line', { x1: right, x2: right, y1: 18, y2: 135, stroke: 'var(--ink-muted)', 'stroke-dasharray': '3 4' }));
  label('today', right, 151, 'middle', 'axis-label');
  if (card.first && card.latest) {
    const firstX = x(card.first.date), lastX = x(card.latest.date);
    svg.append(svgElement('line', { x1: firstX, x2: lastX, y1: 28, y2: 28, stroke: 'var(--series-1)', 'stroke-width': 2 }));
    for (const date of card.versionDates || []) svg.append(markTitle(svgElement('circle', { cx: x(date), cy: 28, r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2 }), date));
    svg.append(markTitle(svgElement('circle', { cx: lastX, cy: 28, r: 7, fill: 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2 }), `${card.latest.status}, ${card.latest.date}`));
    label(`first draft ${card.first.date.slice(0, 4)}`, firstX, 12, firstX > 340 ? 'end' : 'start');
    label(`${STATUS[card.latest.status] || card.latest.status} ${card.latest.date.slice(0, 4)}`, lastX, 49, lastX > 340 ? 'end' : 'start');
  }
  for (const item of card.reviews || []) {
    const area = REVIEW_AREAS.findIndex(area => item.repository_url.endsWith('/' + area.repo));
    if (area < 0) continue;
    const cy = 63 + area * 11;
    const mark = svgElement('g');
    mark.append(svgElement('circle', { cx: x(item.created_at), cy, r: 7, fill: 'var(--series-2)', stroke: 'var(--surface)', 'stroke-width': 2 }));
    mark.append(svgElement('text', { x: x(item.created_at), y: cy + 3, 'text-anchor': 'middle', class: 'review-letter' }, REVIEW_AREAS[area].letter));
    svg.append(markTitle(mark, `${REVIEW_AREAS[area].label}, #${item.number}, ${item.state}, ${dateOnly(item.created_at)}`));
  }
  if (card.lastCommit) svg.append(markTitle(svgElement('rect', { x: x(card.lastCommit.date) - 4, y: 122, width: 8, height: 8, fill: 'var(--ink-2)', stroke: 'var(--surface)', 'stroke-width': 2 }), `Last commit ${dateOnly(card.lastCommit.date)}`));
  return svg;
}
function renderTimelines() {
  const loaded = [...cards.values()].filter(card => card.first);
  if (!loaded.length) return;
  const earliest = Math.min(...loaded.map(card => parseDate(card.first.date).getTime()));
  const start = Date.UTC(new Date(earliest).getUTCFullYear(), 0, 1);
  for (const card of loaded) {
    if (!card.timelineHost) continue;
    card.timelineHost.replaceChildren(timeline(card, start));
  }
}
async function loadTime(card, firstPromise, latestPromise, historyPromise) {
  try {
    const [first, latest, history] = await Promise.all([firstPromise, latestPromise, historyPromise]);
    parseDate(first.date); parseDate(latest.date);
    card.first = first; card.latest = latest;
    card.versionDates = (history._links?.['version-history'] || []).map(version => {
      const match = version.href.match(/\/versions\/(\d{4})(\d{2})(\d{2})(?:[/?#]|$)/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
    }).filter(Boolean);
    card.timelineHost = element('div', 'timeline-host');
    const years = wholeYears(first.date);
    renderSection(card, 'time', [card.timelineHost, element('p', 'fact', `${STATUS[latest.status] || latest.status} · first published ${first.date} · ${years} ${years === 1 ? 'year' : 'years'} in process`)]);
    renderTimelines();
  } catch (error) { sectionFailure(card, 'time', error); }
}
const organisationColours = new Map();
function organisationColour(name) {
  if (name === '(no affiliation listed)') return 'var(--other)';
  if (!organisationColours.has(name)) organisationColours.set(name, organisationColours.size < 8 ? `var(--series-${organisationColours.size + 1})` : 'var(--other)');
  return organisationColours.get(name);
}
async function loadEditors(card, latestPromise) {
  try {
    await latestPromise;
    const data = await fetchJSON(`${card.spec._links['latest-version'].href}/editors`, undefined, card.provenance.editors);
    const editors = await Promise.all((data._links?.editors || []).map(async editor => {
      const affiliations = await fetchJSON(`${editor.href}/affiliations`, undefined, card.provenance.editors);
      return { name: editor.title, affiliations: (affiliations._links?.affiliations || []).map(item => item.title) };
    }));
    card.editors = editors;
    if (!editors.length) { renderSection(card, 'editors', [element('p', 'fact', 'no editors listed')]); return; }
    const organisations = [...new Set(editors.flatMap(editor => editor.affiliations))];
    const dots = element('div', 'editor-dots');
    for (const editor of editors) {
      const item = element('div', 'editor-item');
      const colour = organisationColour(editor.affiliations[0] || '(no affiliation listed)');
      const dot = element('span', 'editor-dot'); dot.style.backgroundColor = colour; dot.setAttribute('aria-hidden', 'true');
      const label = element('span', 'editor-label');
      label.append(element('span', 'editor-name', editor.name), element('span', 'editor-affiliation', editor.affiliations.join(', ') || '(no affiliation listed)'));
      item.append(dot, label); dots.append(item);
    }
    const legend = element('div', 'editor-legend');
    for (const name of [...organisations, ...(editors.some(editor => !editor.affiliations.length) ? ['(no affiliation listed)'] : [])]) {
      const entry = element('span', 'legend-entry'); const dot = element('span', 'legend-dot');
      dot.style.backgroundColor = organisationColour(name); dot.setAttribute('aria-hidden', 'true');
      entry.append(dot, document.createTextNode(name)); legend.append(entry);
    }
    renderSection(card, 'editors', [dots, legend, element('p', 'fact', `${editors.length} ${editors.length === 1 ? 'editor' : 'editors'} from ${organisations.length} ${organisations.length === 1 ? 'organisation' : 'organisations'}`)]);
  } catch (error) { sectionFailure(card, 'editors', error); }
}

async function loadCardData(card) {
  const links = card.spec._links;
  const first = fetchJSON(links['first-version'].href, undefined, card.provenance.time);
  const latest = fetchJSON(links['latest-version'].href, undefined, card.provenance.time);
  const history = fetchJSON(links['version-history'].href, undefined, card.provenance.time);
  await Promise.all([loadTime(card, first, latest, history), loadEditors(card, latest)]);
}

async function addCard(shortname) {
  shortname = shortname.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(shortname)) return;
  if (cards.has(shortname)) { document.querySelector('#page-message').textContent = `${shortname} is already on the page.`; return; }
  document.querySelector('#page-message').textContent = '';
  const card = makeCard(shortname); cards.set(shortname, card); document.querySelector('#cards').append(card.node);
  try {
    card.spec = await fetchJSON(`https://api.w3.org/specifications/${encodeURIComponent(shortname)}`, undefined, card.provenance.time);
    card.title.textContent = card.spec.title;
    await loadCardData(card);
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
