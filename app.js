'use strict';
const DEMO_SPECS = ['battery-status', 'payment-request', 'webauthn-3'];
const ANGLES = {
  time: 'Standards decisions affect digital infrastructure for decades. Meaningful participation requires sustained engagement, and maintenance needs funding, not just initial development.',
  editors: 'Fund time for people to engage deeply with technical details. Fellowships for underrepresented participants and mentorship pairing newcomers with experienced participants are two ways in.',
  review: 'Accessibility, internationalization and privacy assessments are often completely absent from standards work because industry participants may not see them as relevant. Fund independent impact assessments.',
  maintenance: 'Maintenance means updating the standard based on experience, fixing errors and adding needed features. Fund long-term maintenance, not just initial development.'
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
let w3cQueue = Promise.resolve();
async function liveFetch(url, headers) {
  const isW3C = new URL(url).hostname === 'api.w3.org';
  if (isW3C) {
    const turn = w3cQueue;
    w3cQueue = turn.then(() => new Promise(resolve => setTimeout(resolve, 500)));
    await turn;
  }
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, headers ? { headers } : undefined);
    if (response.status !== 429 || attempt === 2) return response;
    const retryAfter = Number(response.headers.get('Retry-After'));
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, Math.max(2000, retryAfter * 1000 || 2000))));
  }
}
async function fetchJSON(url, headers, provenance = new Set()) {
  try {
    const response = await liveFetch(url, headers);
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
let activeHelp = null;
let helpSequence = 0;
function positionHelp(help) {
  const section = help.section.getBoundingClientRect();
  const button = help.button.getBoundingClientRect();
  const width = Math.min(340, section.width);
  help.popover.style.width = `${width}px`;
  help.popover.style.left = `${Math.max(0, Math.min(button.left - section.left, section.width - width))}px`;
  help.popover.style.top = `${button.bottom - section.top + 6}px`;
}
function closeHelp() {
  if (!activeHelp) return;
  clearTimeout(activeHelp.closeTimer);
  activeHelp.popover.hidden = true;
  activeHelp.button.setAttribute('aria-expanded', 'false');
  activeHelp.pinned = false;
  activeHelp = null;
}
function openHelp(help, pinned = false) {
  if (activeHelp !== help) closeHelp();
  clearTimeout(help.closeTimer);
  activeHelp = help;
  help.pinned ||= pinned;
  help.popover.hidden = false;
  help.button.setAttribute('aria-expanded', 'true');
  positionHelp(help);
}
function sectionHeading(section, heading, angle) {
  const row = element('div', 'section-heading');
  const control = element('span', 'help-control');
  const button = element('button', 'help-button', '?');
  const popover = element('span', 'help-popover', angle);
  popover.id = `funder-angle-${++helpSequence}`; popover.hidden = true; popover.setAttribute('role', 'tooltip');
  button.type = 'button'; button.setAttribute('aria-label', 'What the funder guide says');
  button.setAttribute('aria-describedby', popover.id); button.setAttribute('aria-expanded', 'false');
  const help = { section, control, button, popover, pinned: false, closeTimer: null };
  control.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') openHelp(help); });
  control.addEventListener('pointerleave', () => {
    help.closeTimer = setTimeout(() => { if (activeHelp === help && !help.pinned && document.activeElement !== button) closeHelp(); }, 160);
  });
  button.addEventListener('pointerdown', () => { help.pointerFocusing = true; });
  button.addEventListener('pointercancel', () => { help.pointerFocusing = false; });
  button.addEventListener('focus', () => { if (!help.pointerFocusing) openHelp(help); });
  control.addEventListener('focusout', event => { help.pointerFocusing = false; if (activeHelp === help && !control.contains(event.relatedTarget)) closeHelp(); });
  button.addEventListener('click', () => {
    // Pointer focus defers to this toggle; keyboard focus can open it independently.
    help.pointerFocusing = false;
    if (activeHelp === help) closeHelp(); else openHelp(help, true);
  });
  control.append(button, popover); row.append(element('h3', '', heading), control);
  return row;
}
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeHelp(); });
document.addEventListener('pointerdown', event => { if (activeHelp && !activeHelp.control.contains(event.target)) closeHelp(); });
window.addEventListener('resize', () => { if (activeHelp) positionHelp(activeHelp); });
function makeCard(shortname) {
  const node = element('article', 'card'); node.setAttribute('aria-busy', 'true');
  const header = element('header', 'card-header');
  const title = element('h2', '', shortname);
  const remove = element('button', 'remove-button', 'Remove');
  remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${shortname}`);
  remove.addEventListener('click', () => { if (activeHelp && node.contains(activeHelp.button)) closeHelp(); cards.delete(card.shortname); node.remove(); renderTimelines(); });
  header.append(title, link(shortname, `https://www.w3.org/TR/${shortname}/`, 'spec-link'), remove);
  node.append(header);
  const card = { shortname, node, title, sections: {}, provenance: {}, first: null };
  for (const [key, heading] of Object.entries({ time: 'Time in process', editors: 'Editors', review: 'Review', maintenance: 'Maintenance' })) {
    const section = element('section', 'card-section');
    const body = element('div', `section-body ${key}-body`);
    body.append(element('p', 'loading', 'loading…'));
    const note = element('p', 'cached-note');
    section.append(sectionHeading(section, heading, ANGLES[key]), body, note);
    node.append(section); card.sections[key] = { section, body, note }; card.provenance[key] = new Set();
  }
  card.footer = element('footer', 'card-footer');
  card.footer.append(link('Search implementations', `https://webstatus.dev/?q=${encodeURIComponent(shortname)}`));
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
function contextStrip(card, start) {
  const left = 18, right = 508;
  const x = value => left + (parseDate(value).getTime() - start) / Math.max(1, today.getTime() - start) * (right - left);
  const firstX = x(card.first.date), lastX = x(card.latest.date);
  const svg = svgElement('svg', { viewBox: '0 0 540 22', preserveAspectRatio: 'none', class: 'context-strip', role: 'img', 'aria-label': `Shared context: ${new Date(start).getUTCFullYear()} to today` });
  svg.append(svgElement('title', {}, `first draft ${card.first.date} to ${STATUS[card.latest.status] || card.latest.status} ${card.latest.date}`));
  // The shaded extent (first draft to today) is expanded in the detail view below.
  svg.append(svgElement('rect', { x: firstX, y: 0, width: Math.max(0, right - firstX), height: 10, fill: 'var(--grid)', opacity: .4 }));
  svg.append(svgElement('line', { x1: firstX, x2: lastX, y1: 5, y2: 5, stroke: 'var(--series-1)', 'stroke-width': 2 }));
  for (const cx of [firstX, lastX]) svg.append(svgElement('circle', { cx, cy: 5, r: 2.5, fill: 'var(--series-1)' }));
  svg.append(svgElement('line', { x1: right, x2: right, y1: 0, y2: 12, stroke: 'var(--ink-muted)', 'stroke-dasharray': '2 2' }));
  svg.append(svgElement('text', { x: left, y: 21, class: 'axis-label' }, String(new Date(start).getUTCFullYear())));
  svg.append(svgElement('text', { x: right, y: 21, class: 'axis-label', 'text-anchor': 'end' }, `${today.getUTCFullYear()} · today`));
  return svg;
}
function timeline(card, start) {
  const width = 540, height = 114, left = 18, right = 508;
  const end = today.getTime();
  const x = value => left + (parseDate(value).getTime() - start) / Math.max(1, end - start) * (right - left);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, class: 'timeline', role: 'img', 'aria-label': `Detail: publication, review and commit timeline from ${card.first.date} to today` });
  const label = (text, px, py, anchor = 'start', cls = '') => svg.append(svgElement('text', { x: px, y: py, 'text-anchor': anchor, class: cls }, text));
  svg.append(svgElement('rect', { x: 0, y: 0, width, height: 2, fill: 'var(--grid)', opacity: .4 }));
  const years = today.getUTCFullYear() - new Date(start).getUTCFullYear();
  const step = years > 12 ? 3 : years > 6 ? 2 : 1;
  for (let year = new Date(start).getUTCFullYear(); year <= today.getUTCFullYear(); year += step) {
    const px = year === new Date(start).getUTCFullYear() ? left : x(`${year}-01-01`);
    svg.append(svgElement('line', { x1: px, x2: px, y1: 7, y2: 101, stroke: 'var(--grid)' }));
    // Keep the final year label clear of "today".
    if (right - px > 36) label(String(year), px, 111, 'middle', 'axis-label');
  }
  svg.append(svgElement('line', { x1: right, x2: right, y1: 7, y2: 101, stroke: 'var(--ink-muted)', 'stroke-dasharray': '3 4' }));
  label('today', right, 111, 'middle', 'axis-label');
  if (card.first && card.latest) {
    const firstX = x(card.first.date), lastX = x(card.latest.date);
    svg.append(svgElement('line', { x1: firstX, x2: lastX, y1: 13, y2: 13, stroke: 'var(--series-1)', 'stroke-width': 2 }));
    const dates = card.versionDates || [];
    const dense = dates.length > 12;
    for (const date of dates) {
      if (date === card.latest.date || (dense && date === card.first.date)) continue;
      const mark = dense
        ? svgElement('line', { x1: x(date), x2: x(date), y1: 9, y2: 17, stroke: 'var(--series-1)', 'stroke-width': 1, class: 'publication-tick' })
        : svgElement('circle', { cx: x(date), cy: 13, r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2, class: 'publication-circle' });
      svg.append(markTitle(mark, date));
    }
    if (dense) svg.append(markTitle(svgElement('circle', { cx: firstX, cy: 13, r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2, class: 'publication-circle' }), card.first.date));
    svg.append(markTitle(svgElement('circle', { cx: lastX, cy: 13, r: 7, fill: 'var(--series-1)', stroke: 'var(--surface)', 'stroke-width': 2, class: 'publication-circle' }), `${card.latest.status}, ${card.latest.date}`));
    label(`${STATUS[card.latest.status] || card.latest.status} ${card.latest.date.slice(0, 4)}`, lastX, 29, lastX > 340 ? 'end' : 'start');
  }
  REVIEW_AREAS.forEach((area, index) => {
    const items = (card.reviews || []).filter(item => item.repository_url.endsWith('/' + area.repo)).sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
    const cy = 39 + index * 11;
    // Earlier requests remain dated marks, without competing letter labels.
    for (const item of items.slice(1)) svg.append(markTitle(svgElement('line', { x1: x(item.created_at), x2: x(item.created_at), y1: cy - 4, y2: cy + 4, stroke: 'var(--series-2)', 'stroke-width': 1, class: 'review-tick' }), `${area.label}, #${item.number}, ${item.state}, ${dateOnly(item.created_at)}`));
    if (!items.length) return;
    const item = items[0];
    const mark = svgElement('g', { class: 'latest-review' });
    mark.append(svgElement('circle', { cx: x(item.created_at), cy, r: 7, fill: 'var(--series-2)', stroke: 'var(--surface)', 'stroke-width': 2 }));
    mark.append(svgElement('text', { x: x(item.created_at), y: cy + 3.5, 'text-anchor': 'middle', class: 'review-letter' }, area.letter));
    svg.append(markTitle(mark, `${area.label}, #${item.number}, ${item.state}, ${dateOnly(item.created_at)}`));
  });
  if (card.lastCommit) svg.append(markTitle(svgElement('rect', { x: x(card.lastCommit.date) - 4, y: 95, width: 8, height: 8, fill: 'var(--ink-2)', stroke: 'var(--surface)', 'stroke-width': 2 }), `Last commit ${dateOnly(card.lastCommit.date)}`));
  return svg;
}
function renderTimelines() {
  const loaded = [...cards.values()].filter(card => card.first);
  if (!loaded.length) return;
  const earliest = Math.min(...loaded.map(card => parseDate(card.first.date).getTime()));
  const start = Date.UTC(new Date(earliest).getUTCFullYear(), 0, 1);
  for (const card of loaded) {
    if (!card.timelineHost) continue;
    card.timelineHost.replaceChildren(contextStrip(card, start), timeline(card, parseDate(card.first.date).getTime()));
  }
}
function updateTimeFact(card) {
  if (!card.timeFact || !card.first || !card.latest) return;
  const years = wholeYears(card.first.date);
  let text = `${STATUS[card.latest.status] || card.latest.status} · first published ${card.first.date} · ${years} ${years === 1 ? 'year' : 'years'} in process`;
  if (card.seriesFirst && card.seriesFirst !== card.first.date && card.spec['series-version']) text += ` · Level ${card.spec['series-version']} · series since ${card.seriesFirst.slice(0, 4)}`;
  card.timeFact.textContent = text;
  if (card.seriesError) card.timeFact.append(element('span', 'load-error', " · couldn't load series history"));
  card.sections.time.note.textContent = card.provenance.time.size ? `cached ${[...card.provenance.time].join(', ')}` : '';
}
async function loadSeries(card, firstPromise) {
  const seriesURL = card.spec._links?.series?.href;
  if (!seriesURL) return;
  try {
    const data = await fetchJSON(`${seriesURL}/specifications`, undefined, card.provenance.time);
    const entries = data._links?.specifications || [];
    if (entries.length <= 1) { updateTimeFact(card); return; }
    // W3C does not return these in chronological order (WebAuthn Level 2 precedes Level 1).
    const dates = await Promise.all(entries.map(async entry => {
      if (entry.href === card.spec._links?.self?.href) return (await firstPromise).date;
      const spec = await fetchJSON(entry.href, undefined, card.provenance.time);
      const version = await fetchJSON(spec._links['first-version'].href, undefined, card.provenance.time);
      parseDate(version.date); return version.date;
    }));
    card.seriesFirst = dates.sort()[0];
    updateTimeFact(card);
  } catch (error) {
    console.error(card.shortname, 'time', error);
    card.seriesError = true; updateTimeFact(card);
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
    card.timeFact = element('p', 'fact');
    renderSection(card, 'time', [card.timelineHost, card.timeFact]);
    updateTimeFact(card);
    renderTimelines();
  } catch (error) { sectionFailure(card, 'time', error); }
}
const organisationColours = new Map();
function organisationColour(name) {
  if (name === '(no affiliation listed)') return 'var(--other)';
  if (!organisationColours.has(name)) organisationColours.set(name, organisationColours.size < 8 ? `var(--series-${organisationColours.size + 1})` : 'var(--other)');
  return organisationColours.get(name);
}
function cleanEditorName(name) {
  return String(name || '').replace(/[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
}
async function loadEditors(card, latestPromise) {
  try {
    await latestPromise;
    const data = await fetchJSON(`${card.spec._links['latest-version'].href}/editors`, undefined, card.provenance.editors);
    const editors = await Promise.all((data._links?.editors || []).map(async editor => {
      const affiliations = await fetchJSON(`${editor.href}/affiliations`, undefined, card.provenance.editors);
      return { name: cleanEditorName(editor.title), affiliations: (affiliations._links?.affiliations || []).map(item => item.title) };
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
    for (const name of organisations) {
      const entry = element('span', 'legend-entry'); const dot = element('span', 'legend-dot');
      dot.style.backgroundColor = organisationColour(name); dot.setAttribute('aria-hidden', 'true');
      entry.append(dot, document.createTextNode(name)); legend.append(entry);
    }
    renderSection(card, 'editors', [dots, legend, element('p', 'fact', `${editors.length} ${editors.length === 1 ? 'editor' : 'editors'} from ${organisations.length} ${organisations.length === 1 ? 'organisation' : 'organisations'}`)]);
  } catch (error) { sectionFailure(card, 'editors', error); }
}

const REVIEW_AREAS = [
  { label: 'Accessibility', letter: 'A', repo: 'w3c/a11y-request' },
  { label: 'Internationalization', letter: 'I', repo: 'w3c/i18n-request' },
  { label: 'Privacy', letter: 'P', repo: 'w3cping/privacy-request' },
  { label: 'Security', letter: 'S', repo: 'w3c/security-request' },
  { label: 'TAG', letter: 'T', repo: 'w3ctag/design-reviews' }
];
let specIndexPromise;
let w3cEntries = [];
function populateShortnames(data) {
  w3cEntries = data.filter(entry => entry.organization === 'W3C');
  document.querySelector('#spec-shortnames').replaceChildren(...w3cEntries.map(entry => {
    const option = element('option'); option.value = entry.shortname; option.label = entry.title; return option;
  }));
}
function resolveShortname(value) {
  const text = value.trim().toLowerCase();
  const exact = w3cEntries.find(entry => entry.shortname.toLowerCase() === text);
  if (exact) return exact.shortname;
  const matches = w3cEntries.filter(entry => {
    const names = [entry.title, entry.series?.shortTitle, entry.series?.shortname, entry.shortname.replaceAll('-', ' ')].filter(Boolean);
    return names.some(name => name.toLowerCase() === text || name.replace(/\s+API$/i, '').toLowerCase() === text);
  });
  return matches.find(entry => cards.has(entry.shortname))?.shortname || matches.find(entry => entry.shortname === entry.series?.currentSpecification)?.shortname || matches[0]?.shortname || value.trim();
}
function specIndex() {
  if (!specIndexPromise) {
    const provenance = new Set();
    specIndexPromise = fetchJSON('https://cdn.jsdelivr.net/npm/web-specs@latest/index.json', undefined, provenance).then(data => {
      if (!Array.isArray(data)) throw new Error('Invalid specification index');
      populateShortnames(data);
      return { data, provenance };
    }).catch(error => { specIndexPromise = null; throw error; });
  }
  return specIndexPromise;
}
function inheritProvenance(target, source) { for (const date of source) target.add(date); }
function githubHeaders() { return githubToken ? { Authorization: `Bearer ${githubToken}` } : undefined; }
function reviewPhrase(card, entry) {
  return (entry?.series?.shortTitle || card.spec.title.split(':')[0]).replace(/\s+(level\s*)?\d+(\.\d+)?$/i, '').trim();
}
const REVIEW_LABELS = [
  'i18n-needs-resolution', 'a11y-needs-resolution', 'privacy-needs-resolution',
  'security-needs-resolution', 'tag-needs-resolution', 'i18n-tracker',
  'a11y-tracker', 'privacy-tracker', 'security-tracker', 'tag-tracker'
];
async function loadOpenReviewCount(card, repository, run, host) {
  const query = `repo:${repository} is:issue is:open label:${REVIEW_LABELS.join(',')}`;
  try {
    const data = await fetchJSON(`https://api.github.com/search/issues?per_page=1&q=${encodeURIComponent(query)}`, githubHeaders(), card.provenance.maintenance);
    if (card.githubRun !== run) return;
    if (!Number.isInteger(data.total_count) || data.total_count < 0) throw new Error('Invalid open review issue count');
    host.replaceChildren(link(`${data.total_count} open from horizontal review`, `https://github.com/${repository}/issues?q=${encodeURIComponent(query)}`));
  } catch (error) {
    if (card.githubRun !== run) return;
    console.error(card.shortname, 'maintenance', error);
    host.replaceChildren(element('span', 'load-error', "couldn't load open review issues"));
  }
  card.sections.maintenance.note.textContent = card.provenance.maintenance.size ? `cached ${[...card.provenance.maintenance].join(', ')}` : '';
}
function belongsToLevel(title, version) {
  if (version === undefined || version === null || version === '') return true;
  // Review trackers append dates/deadlines; a date is not a spec level.
  const subject = title.replace(/\s+\d{4}-\d{2}-\d{2}(?:\s*>\s*\d{4}-\d{2}-\d{2})?\s*$/, '').trim();
  const named = subject.match(/\b(level|l)\s*(\d+)\b/i);
  const trailing = subject.match(/\bv?(\d+)(\.\d+)?$/);
  const mentioned = named ? named[2] : trailing ? trailing[1] + (trailing[2] || '') : null;
  return mentioned === null || Number(mentioned) === Number(version);
}
async function loadReview(card, entry, run) {
  try {
    const phrase = reviewPhrase(card, entry).replaceAll('"', '');
    const query = `("${phrase}" OR ${card.shortname}) in:title is:issue ${REVIEW_AREAS.map(area => `repo:${area.repo}`).join(' ')}`;
    const data = await fetchJSON(`https://api.github.com/search/issues?per_page=50&q=${encodeURIComponent(query)}`, githubHeaders(), card.provenance.review);
    if (!Array.isArray(data.items)) throw new Error('Invalid review search response');
    if (card.githubRun !== run) return;
    card.reviews = data.items.filter(item => !/charter/i.test(item.title) && belongsToLevel(item.title, card.spec['series-version']) && REVIEW_AREAS.some(area => item.repository_url.endsWith('/' + area.repo)));
    const list = element('dl', 'review-list');
    for (const area of REVIEW_AREAS) {
      const items = card.reviews.filter(item => item.repository_url.endsWith('/' + area.repo)).sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
      const row = element('div', 'review-row'); const value = element('dd');
      if (items.length) { const item = items[0]; value.append(link(`#${item.number} ${item.state}, ${dateOnly(item.created_at)}`, item.html_url)); }
      else value.textContent = 'no request found';
      row.append(element('dt', '', area.label), value); list.append(row);
    }
    renderSection(card, 'review', [list]); renderTimelines();
  } catch (error) {
    if (card.githubRun === run) {
      sectionFailure(card, 'review', error);
    }
  }
}
function repositoryFor(card, entry) {
  const candidate = entry?.nightly?.repository;
  if (candidate) {
    const match = candidate.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
    if (match) return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
  }
  try {
    const url = new URL(card.spec['editor-draft']);
    const owner = url.hostname.match(/^([a-z0-9-]+)\.github\.io$/i)?.[1];
    const repo = url.pathname.split('/').filter(Boolean)[0];
    if (owner && repo) return `${owner}/${repo}`;
  } catch { /* A spec need not have a GitHub editor draft. */ }
  return null;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function commitActivity(url, headers, provenance, onPending) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const data = await fetchJSON(url, headers, provenance);
    if (Array.isArray(data) && data.length === 52 && data.every(week => Number.isFinite(week.week) && Number.isFinite(week.total))) return data;
    delete responses[url];
    if (attempt < 7) { onPending(); await delay(2500); }
  }
  throw new Error('Commit activity is still being computed after eight attempts');
}
function commitStrip(weeks) {
  const width = 260, height = 44, gap = 2, barWidth = (width - gap * 51) / 52;
  const max = Math.max(1, ...weeks.map(week => week.total));
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, class: 'commit-strip', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Weekly commits over the last 52 weeks; scale is local to this card' });
  svg.append(svgElement('line', { x1: 0, x2: width, y1: 43, y2: 43, stroke: 'var(--grid)' }));
  weeks.forEach((week, index) => {
    const x = index * (barWidth + gap), h = week.total / max * 40, y = 43 - h, r = Math.min(4, h, barWidth / 2);
    const mark = svgElement('g');
    // Transparent hit area keeps zero-count weeks available on hover without inventing a bar.
    mark.append(svgElement('rect', { x, y: 0, width: barWidth, height: 44, fill: 'transparent' }));
    if (week.total) mark.append(svgElement('path', { d: `M${x},43 V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V43 Z`, fill: 'var(--series-1)' }));
    svg.append(markTitle(mark, `${dateOnly(new Date(week.week * 1000))}: ${week.total} ${week.total === 1 ? 'commit' : 'commits'}`));
  });
  return svg;
}
async function loadMaintenance(card, entry, run) {
  const repository = repositoryFor(card, entry);
  if (!repository) { if (card.githubRun === run) renderSection(card, 'maintenance', [element('p', 'fact', 'no repository found')]); return; }
  const base = `https://api.github.com/repos/${repository}`;
  const headers = githubHeaders();
  // Render independent figures as each call resolves, including when activity takes time to compute.
  const figures = element('div', 'maintenance-figures');
  const activity = element('div', 'maintenance-block activity-block');
  const entryPoints = element('div', 'maintenance-block entry-points-block');
  const issues = element('div', 'maintenance-figure'); issues.append(element('span', 'loading', 'loading…'));
  const count = element('div', 'maintenance-figure'); count.append(element('span', 'loading', 'loading…'));
  const openCount = element('p', 'review-open-issues'); openCount.append(element('span', 'loading', 'loading…'));
  const strip = element('div', 'commit-strip-host');
  const last = element('p', 'last-commit'); last.append(element('span', 'loading', 'loading…'));
  activity.append(element('h4', 'maintenance-label', 'Activity'), count, strip, last);
  entryPoints.append(element('h4', 'maintenance-label', 'Entry points'), issues, openCount);
  figures.append(activity, entryPoints);
  renderSection(card, 'maintenance', [figures]);
  const note = () => { card.sections.maintenance.note.textContent = card.provenance.maintenance.size ? `cached ${[...card.provenance.maintenance].join(', ')}` : ''; };
  const fail = (target, error) => {
    if (card.githubRun !== run) return;
    console.error(card.shortname, 'maintenance', error);
    target.replaceChildren(element('span', 'load-error', "couldn't load")); note();
  };
  await Promise.all([
    loadOpenReviewCount(card, repository, run, openCount),
    fetchJSON(base, headers, card.provenance.maintenance).then(data => {
      if (card.githubRun !== run) return;
      if (!Number.isFinite(data.open_issues_count)) throw new Error('Invalid repository issue count');
      issues.replaceChildren(link(`${data.open_issues_count} open issues and pull requests in the series repository`, `${data.html_url}/issues`)); note();
    }).catch(error => fail(issues, error)),
    fetchJSON(`${base}/commits?per_page=1`, headers, card.provenance.maintenance).then(data => {
      if (card.githubRun !== run) return;
      if (!Array.isArray(data) || !data[0]?.commit?.committer?.date) throw new Error('No commit date returned');
      card.lastCommit = { date: data[0].commit.committer.date, url: data[0].html_url };
      last.replaceChildren(link(`Last commit ${dateOnly(card.lastCommit.date)}`, card.lastCommit.url)); note(); renderTimelines();
    }).catch(error => fail(last, error)),
    commitActivity(`${base}/stats/commit_activity`, headers, card.provenance.maintenance, () => {
      if (card.githubRun === run) count.replaceChildren(element('span', 'loading', 'GitHub is computing commit activity…'));
    }).then(weeks => {
      if (card.githubRun !== run) return;
      const total = weeks.reduce((sum, week) => sum + week.total, 0);
      count.textContent = `${total} ${total === 1 ? 'commit' : 'commits'} in the last 52 weeks, series repository`;
      strip.replaceChildren(commitStrip(weeks)); note();
    }).catch(error => fail(count, error))
  ]);
}
async function loadGithubSections(card, indexPromise) {
  const run = card.githubRun = (card.githubRun || 0) + 1;
  card.reviews = []; card.lastCommit = null;
  for (const key of ['review', 'maintenance']) {
    card.provenance[key] = new Set(card.specProvenance);
    renderSection(card, key, [element('p', 'loading', 'loading…')]);
  }
  renderTimelines();
  let entry;
  try {
    const index = await indexPromise;
    entry = index.data.find(item => item.shortname === (card.spec.shortname || card.shortname));
    for (const key of ['review', 'maintenance']) inheritProvenance(card.provenance[key], index.provenance);
  } catch (error) { console.error(card.shortname, 'specification index', error); }
  if (card.githubRun !== run) return;
  card.footer.firstChild.href = `https://webstatus.dev/?q=${encodeURIComponent(entry?.series?.shortTitle || card.shortname)}`;
  await Promise.all([loadReview(card, entry, run), loadMaintenance(card, entry, run)]);
}

async function loadPatents(card, latestPromise, indexPromise) {
  const provenance = new Set(card.specProvenance);
  let url;
  try {
    const latest = await latestPromise;
    const deliverers = await fetchJSON(latest._links.deliverers.href, undefined, provenance);
    const groupURL = deliverers._links?.deliverers?.[0]?.href;
    if (!groupURL) throw new Error('No delivering group returned');
    const group = await fetchJSON(groupURL, undefined, provenance);
    url = group._links?.['pp-status']?.href;
    if (!url) throw new Error('No IPR page returned');
  } catch (error) {
    console.error(card.shortname, 'patents', error);
    try {
      const index = await indexPromise;
      inheritProvenance(provenance, index.provenance);
      const entry = index.data.find(item => item.shortname === card.shortname);
      if (entry?.groups?.[0]?.url) url = `${entry.groups[0].url.replace(/\/?$/, '/')}ipr/`;
    } catch (indexError) { console.error(card.shortname, 'patents', indexError); }
  }
  if (url) card.footer.append(link('Patents', url, 'patent-link'));
  if (provenance.size) card.footer.append(element('span', 'patent-cache-note', `cached ${[...provenance].join(', ')}`));
}
async function loadCardData(card) {
  const links = card.spec._links;
  const index = specIndex();
  const version = async relation => {
    const url = links?.[relation]?.href;
    if (!url) throw new Error(`No ${relation} URL returned`);
    return fetchJSON(url, undefined, card.provenance.time);
  };
  const first = version('first-version');
  const latest = version('latest-version');
  const history = version('version-history');
  await Promise.all([loadTime(card, first, latest, history), loadSeries(card, first), loadEditors(card, latest), loadGithubSections(card, index), loadPatents(card, latest, index)]);
}

async function addCard(shortname) {
  shortname = shortname.trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(shortname)) return;
  if ([...cards.keys()].some(key => key.toLowerCase() === shortname.toLowerCase())) { document.querySelector('#page-message').textContent = `${shortname} is already on the page.`; return; }
  document.querySelector('#page-message').textContent = '';
  const card = makeCard(shortname); cards.set(shortname, card); document.querySelector('#cards').append(card.node);
  try {
    card.spec = await fetchJSON(`https://api.w3.org/specifications/${encodeURIComponent(shortname)}`, undefined, card.provenance.time);
    const canonical = card.spec.shortname || shortname;
    if (cards.get(shortname) !== card) return; // Removed while its request was in flight.
    if (canonical !== shortname) {
      if (cards.has(canonical)) { cards.delete(shortname); card.node.remove(); renderTimelines(); return; }
      const ordered = [...cards.entries()].map(([key, value]) => [value === card ? canonical : key, value]);
      cards.clear(); for (const [key, value] of ordered) cards.set(key, value);
    }
    card.shortname = canonical;
    card.node.querySelector('.spec-link').textContent = canonical;
    card.node.querySelector('.spec-link').href = `https://www.w3.org/TR/${encodeURIComponent(canonical)}/`;
    card.node.querySelector('.remove-button').setAttribute('aria-label', `Remove ${canonical}`);
    card.footer.firstChild.href = `https://webstatus.dev/?q=${encodeURIComponent(canonical)}`;
    card.title.textContent = card.spec.title;
    card.specProvenance = new Set(card.provenance.time);
    for (const key of Object.keys(card.sections)) inheritProvenance(card.provenance[key], card.specProvenance);
    await loadCardData(card);
  } catch (error) {
    console.error(shortname, 'specification', error);
    for (const section of Object.values(card.sections)) section.section.remove();
    card.node.insertBefore(element('p', 'load-error', error.status === 404 ? `couldn't find ${shortname}` : "couldn't load specification"), card.footer);
  } finally { card.node.setAttribute('aria-busy', 'false'); }
}
document.querySelector('#add-spec').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#shortname'); const typed = input.value;
  if (!w3cEntries.length) { try { await specIndex(); } catch { /* A direct shortname lookup still works without the index. */ } }
  const shortname = resolveShortname(typed);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(shortname)) {
    document.querySelector('#page-message').textContent = 'Enter a W3C shortname or choose a title from the suggestions.'; return;
  }
  addCard(shortname); input.value = '';
});
tokenInput.addEventListener('change', () => {
  githubToken = tokenInput.value.trim();
  try { if (githubToken) sessionStorage.setItem('github-token', githubToken); else sessionStorage.removeItem('github-token'); } catch { /* Memory remains available. */ }
  for (const card of cards.values()) if (card.spec) loadGithubSections(card, specIndex());
});
document.querySelector('#export-cache').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ _generated: new Date().toISOString(), ...responses }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const download = document.createElement('a');
  download.href = url; download.download = 'demo-cache.json'; download.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const walkthroughSteps = ['time', 'editors', 'review', 'maintenance'];
const walkthroughClosing = 'Same data, same sources. The difference is what a funder can act on.';
let walkthroughStep = -1;
const walkthroughLauncher = document.querySelector('#walk-through');
const walkthroughBanner = document.querySelector('#walkthrough-banner');
const walkthroughGuide = document.querySelector('#walkthrough-guide');
const walkthroughFact = document.querySelector('#walkthrough-fact');
const walkthroughNext = document.querySelector('#walkthrough-next');
const walkthroughDone = document.querySelector('#walkthrough-done');
function firstCardSummary(key) {
  const card = cards.values().next().value;
  if (!card) return 'Add a card to show its facts.';
  const title = card.spec?.title || card.shortname;
  if (!card.spec) return `${title} — ${card.node.querySelector('.load-error')?.textContent || 'loading…'}`;
  const body = card.sections[key].body;
  let fact;
  if (key === 'time' || key === 'editors') fact = body.querySelector('.fact')?.textContent;
  if (key === 'review' && !body.querySelector('.loading, .load-error')) {
    const latest = new Map();
    for (const item of card.reviews || []) {
      const previous = latest.get(item.repository_url);
      if (!previous || parseDate(item.created_at) > parseDate(previous.created_at)) latest.set(item.repository_url, item);
    }
    fact = `${latest.size} review areas with requests; ${[...latest.values()].filter(item => item.state === 'open').length} latest requests open`;
  }
  if (key === 'maintenance') fact = [...body.querySelectorAll('.maintenance-figure, .review-open-issues')].map(node => node.textContent).join(' · ');
  fact ||= body.querySelector('.load-error, .loading')?.textContent || "couldn't load";
  return `${title} — ${fact.replace(/\s+/g, ' ').trim()}`;
}
function renderWalkthrough() {
  const active = walkthroughStep >= 0;
  const key = walkthroughSteps[walkthroughStep];
  document.body.classList.toggle('walkthrough-active', active);
  walkthroughLauncher.setAttribute('aria-pressed', String(active));
  walkthroughBanner.hidden = !active;
  for (const card of cards.values()) for (const [sectionKey, section] of Object.entries(card.sections)) section.section.classList.toggle('walkthrough-highlight', active && sectionKey === key);
  if (!active) return;
  const guide = key ? ANGLES[key] : walkthroughClosing;
  const fact = key ? firstCardSummary(key) : '';
  if (walkthroughGuide.textContent !== guide) walkthroughGuide.textContent = guide;
  if (walkthroughFact.textContent !== fact) walkthroughFact.textContent = fact;
  walkthroughFact.hidden = !key;
  walkthroughNext.hidden = !key;
  if (!key && document.activeElement === walkthroughNext) walkthroughDone.focus({ preventScroll: true });
}
function endWalkthrough() {
  walkthroughStep = -1; renderWalkthrough();
  walkthroughLauncher.focus({ preventScroll: true });
}
function advanceWalkthrough() {
  if (walkthroughStep >= walkthroughSteps.length) { endWalkthrough(); return; }
  walkthroughStep++; renderWalkthrough();
}
walkthroughLauncher.addEventListener('click', () => {
  if (walkthroughStep >= 0) { endWalkthrough(); return; }
  closeHelp(); walkthroughStep = 0; renderWalkthrough(); walkthroughNext.focus({ preventScroll: true });
});
walkthroughNext.addEventListener('click', advanceWalkthrough);
walkthroughDone.addEventListener('click', endWalkthrough);
walkthroughBanner.addEventListener('click', event => { if (!event.target.closest('button')) advanceWalkthrough(); });
document.addEventListener('keydown', event => {
  if (walkthroughStep < 0) return;
  if (event.key === 'Escape') { event.preventDefault(); endWalkthrough(); return; }
  if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); advanceWalkthrough(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); walkthroughStep = Math.max(0, walkthroughStep - 1); renderWalkthrough(); }
});
new MutationObserver(() => { if (walkthroughStep >= 0) renderWalkthrough(); }).observe(document.querySelector('#cards'), { childList: true, subtree: true, characterData: true });

DEMO_SPECS.forEach(addCard);

// Register after the first page load; no application or API traffic is proxied.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.error('page', 'offline shell', error));
  });
}
