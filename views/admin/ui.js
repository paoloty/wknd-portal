// The admin UI kit (admin redesign step 1, 2026-10-15): one look for every admin page,
// built on the site's own tokens (public/styles.css :root) so the admin matches the site.
// Styles: the "Admin UI kit" block in public/admin.css (.aui-*). Browser side
// (toast, confirm dialog, JSON actions): public/admin-ui.js.
//
// Every helper returns an HTML string. Text arguments are escaped here; arguments named
// *Html are trusted markup the caller built.
import { escHtml } from '../layout.js';

const attr = s => escHtml(String(s ?? ''));

// Page title block: optional eyebrow and sub line, actions on the right (wrap on a phone).
export function pageHeader({ eyebrow = '', title, sub = '', actionsHtml = '' }) {
  return `<header class="aui-head">
    <div class="aui-head__text">
      ${eyebrow ? `<div class="aui-head__eyebrow">${escHtml(eyebrow)}</div>` : ''}
      <h1 class="aui-head__title">${escHtml(title)}</h1>
      ${sub ? `<p class="aui-head__sub">${escHtml(sub)}</p>` : ''}
    </div>
    ${actionsHtml ? `<div class="aui-head__actions">${actionsHtml}</div>` : ''}
  </header>`;
}

// A titled block. The header does the grouping, so the body is one card or a list, never
// cards inside a card.
export function section({ title, note = '', asideHtml = '', bodyHtml, id = '' }) {
  return `<section class="aui-section"${id ? ` id="${attr(id)}"` : ''}>
    <div class="aui-section__head">
      <h2 class="aui-section__title">${escHtml(title)}${note ? ` <span class="aui-section__note">${escHtml(note)}</span>` : ''}</h2>
      ${asideHtml}
    </div>
    ${bodyHtml}
  </section>`;
}

// Tones for badges and deltas. Amber is the accent; green/red/blue are admin-only status
// colours (paid / owes / waitlist, up / down), never used on the public site.
const TONES = new Set(['amber', 'green', 'red', 'blue', 'gray']);
const tone = t => (TONES.has(t) ? t : 'gray');

export function badge(label, t = 'gray') {
  return `<span class="aui-badge aui-badge--${tone(t)}">${escHtml(label)}</span>`;
}

// A number tile. `spark` is an array of numbers (oldest first), drawn only with 2+ points.
export function kpi({ label, value, of = '', delta = '', deltaTone = 'gray', spark = null, href = '' }) {
  const tag = href ? 'a' : 'div';
  return `<${tag} class="aui-kpi"${href ? ` href="${attr(href)}"` : ''}>
    <div class="aui-kpi__label">${escHtml(label)}</div>
    <div class="aui-kpi__row">
      <div class="aui-kpi__value"><b>${escHtml(value)}</b>${of !== '' ? `<span>${escHtml(of)}</span>` : ''}</div>
      ${sparkline(spark)}
    </div>
    ${delta ? `<div class="aui-kpi__delta aui-tone--${tone(deltaTone)}">${escHtml(delta)}</div>` : ''}
  </${tag}>`;
}

export function sparkline(values, { w = 84, h = 28 } = {}) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = 2 + (i * (w - 4)) / (values.length - 1);
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="aui-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function progress(pct, { label = '' } = {}) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="aui-progress">
    <div class="aui-progress__track" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"${label ? ` aria-label="${attr(label)}"` : ''}><div class="aui-progress__fill" style="width:${Math.max(p, 1)}%"></div></div>
    ${label ? `<span class="aui-progress__label">${escHtml(label)}</span>` : ''}
  </div>`;
}

// Buttons: primary (amber, one per area), secondary, ghost, danger. `href` makes a link.
// `attrs` is extra trusted attribute markup (data-confirm etc.).
export function button(label, { kind = 'secondary', size = '', href = '', type = 'button', attrs = '' } = {}) {
  const cls = `aui-btn aui-btn--${kind}${size === 'sm' ? ' aui-btn--sm' : ''}`;
  return href
    ? `<a class="${cls}" href="${attr(href)}" ${attrs}>${escHtml(label)}</a>`
    : `<button type="${type}" class="${cls}" ${attrs}>${escHtml(label)}</button>`;
}

// done: true shows a green check ("all caught up"); otherwise a neutral mark.
export function emptyState({ title, sub = '', done = false }) {
  return `<div class="aui-empty">
    <span class="aui-empty__mark${done ? '' : ' is-neutral'}" aria-hidden="true">${done ? '✓' : '–'}</span>
    <div class="aui-empty__title">${escHtml(title)}</div>
    ${sub ? `<div class="aui-empty__sub">${escHtml(sub)}</div>` : ''}
  </div>`;
}

// Initials in a team-coloured ring (colour from the teams table, never hard-coded).
export function avatar(name, color = '', { size = 28 } = {}) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const ring = /^#[0-9a-f]{3,8}$/i.test(color) ? color : 'rgba(255,255,255,.18)';
  return `<span class="aui-avatar" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px ${ring}" aria-hidden="true">${escHtml(initials)}</span>`;
}

// "5m", "3h", "2d"
export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// Data grid (admin redesign, 2026-10-15). ONE component for every admin list. The server
// filters, sorts and pages (admin lists are small enough to do it in memory), and all of
// that state lives in the URL (?view=&q=&<filter>=&sort=&page=&d=), so a filtered list can
// be bookmarked or shared. public/admin-ui.js adds the live bits: debounced search, ticking
// rows + the bulk bar, the row ⋯ menus, expanding a row. Mockup: canvas "Data grid".
//
// dataGrid({
//   id, baseUrl, query: req.query,
//   rows, rowKey: r => r.id,
//   views:   [{ key, label, test: r => bool }],           first one is the default
//   search:  { placeholder, text: r => 'haystack' },
//   filters: [{ key, label, options: [[value, label]], test: (r, value) => bool }],
//   columns: [{ key, label, sort: r => value, cell: r => html, num, nowrap, phone: false, primary, bare }],
//            (bare: no label in front of the value on a phone, for self-explaining cells like badges)
//   defaultSort: '-joined',   perPage: 25,
//   rowMenu: r => [{ label, href } | { label, post: url, confirm, danger, done } | 'sep'],
//   rowHref: r => url,          (the primary cell links here when there's no expand)
//   expand:  r => html,         (quick facts under the row)
//   bulk:    [{ label, eachUrl: '/x/{id}/y', confirm: { title, body }, done }],
//   groupBy: r => 'label',  footer: (rows) => '<tr>…</tr>',
//   actionsHtml, empty: { title, sub }, noun: ['member', 'members'],
// })
// ════════════════════════════════════════════════════════════════════════════════════════

function gridUrl(baseUrl, params, patch) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${baseUrl}?${s}` : baseUrl;
}

function confirmData(c) {
  if (!c) return '';
  return ` data-confirm data-confirm-title="${attr(c.title)}" data-confirm-body="${attr(c.body || '')}"${c.type ? ` data-confirm-type="${attr(c.type)}"` : ''}${c.send ? ` data-confirm-send="${attr(c.send)}"` : ''}`;
}

// A ⋯ menu: [{ label, href } | { label, post, confirm, danger, done, then } | 'sep']
export function menu(items, label = 'Actions') {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '';
  const inner = list.map(it => {
    if (it === 'sep') return '<div class="aui-menu__sep" role="separator"></div>';
    const cls = `aui-menu__item${it.danger ? ' is-danger' : ''}`;
    if (it.href) return `<a role="menuitem" class="${cls}" href="${attr(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ''}>${escHtml(it.label)}</a>`;
    return `<button type="button" role="menuitem" class="${cls}" data-post-json="${attr(it.post)}"${it.then ? ` data-then="${attr(it.then)}"` : ''} data-done="${attr(it.done || 'Done.')}"${confirmData(it.confirm)}>${escHtml(it.label)}</button>`;
  }).join('');
  return `<details class="aui-menu"><summary class="aui-menu__btn" aria-label="${attr(label)}">⋯</summary><div class="aui-menu__list" role="menu">${inner}</div></details>`;
}

export function dataGrid(o) {
  const q0 = o.query || {};
  const views = o.views?.length ? o.views : [{ key: 'all', label: 'All', test: () => true }];
  const view = views.find(v => v.key === q0.view) || views[0];
  const text = String(q0.q || '').trim();
  const filters = (o.filters || []).map(f => ({ ...f, value: String(q0[f.key] || '') }));
  const cols = o.columns;
  const sortRaw = String(q0.sort || o.defaultSort || '');
  const sortKey = sortRaw.replace(/^-/, '');
  const sortDir = sortRaw.startsWith('-') ? -1 : 1;
  const sortCol = cols.find(c => c.key === sortKey && c.sort);
  const dense = q0.d === 'compact';
  const perPage = o.perPage || 25;
  const [one, many] = o.noun || ['row', 'rows'];

  // The URL params this grid owns, so every link keeps the others.
  // o.keep: extra params every grid link carries (e.g. { tab: 'emails' } on a tabbed page).
  const state = { ...(o.keep || {}), view: view === views[0] ? '' : view.key, q: text, sort: sortRaw === (o.defaultSort || '') ? '' : sortRaw, d: dense ? 'compact' : '' };
  for (const f of filters) state[f.key] = f.value;
  const url = patch => gridUrl(o.baseUrl, state, patch);

  const lc = text.toLowerCase();
  const base = o.rows.filter(r => (!lc || String(o.search?.text?.(r) || '').toLowerCase().includes(lc)) && filters.every(f => !f.value || f.test(r, f.value)));
  const viewCounts = Object.fromEntries(views.map(v => [v.key, base.filter(v.test).length]));
  let list = base.filter(view.test);
  if (sortCol) {
    list = list.map((r, i) => [r, sortCol.sort(r), i]).sort((a, b) => {
      const x = a[1], y = b[1];
      const blank = (x == null || x === '') - (y == null || y === '');
      if (blank) return blank;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return c * sortDir || a[2] - b[2];
    }).map(a => a[0]);
  }
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const page = Math.min(Math.max(1, parseInt(q0.page, 10) || 1), pages);
  const pageRows = list.slice((page - 1) * perPage, page * perPage);
  const filtered = !!text || filters.some(f => f.value) || view !== views[0];

  // Saved views
  const viewsHtml = views.length > 1 ? `<nav class="aui-views" aria-label="Saved views">${views.map(v => {
    const on = v === view;
    return `<a class="aui-views__tab${on ? ' is-active' : ''}" href="${attr(url({ view: v === views[0] ? '' : v.key, page: '' }))}"${on ? ' aria-current="page"' : ''}>${escHtml(v.label)} <span class="aui-views__n">${viewCounts[v.key]}</span></a>`;
  }).join('')}</nav>` : '';

  // Toolbar: one GET form (search + selects); hidden inputs keep the rest of the state.
  const keep = Object.entries({ ...(o.keep || {}), view: state.view, sort: state.sort, d: state.d }).filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${k}" value="${attr(v)}">`).join('');
  const searchHtml = o.search ? `<label class="aui-search"><span class="aui-search__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5 13 13"/></svg></span><input type="search" name="q" value="${attr(text)}" placeholder="${attr(o.search.placeholder || 'Search')}" aria-label="${attr(o.search.placeholder || 'Search')}" data-autosubmit-search></label>` : '';
  const selectsHtml = filters.map(f => `<label class="aui-filter"><span>${escHtml(f.label)}</span><select class="aui-input" name="${attr(f.key)}" data-autosubmit><option value="">All</option>${f.options.map(([v, l]) => `<option value="${attr(v)}"${String(v) === f.value ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select></label>`).join('');
  const chips = [
    ...(text ? [{ label: `“${text}”`, href: url({ q: '', page: '' }) }] : []),
    ...filters.filter(f => f.value).map(f => ({ label: `${f.label}: ${(f.options.find(([v]) => String(v) === f.value) || [null, f.value])[1]}`, href: url({ [f.key]: '', page: '' }) })),
  ];
  const chipsHtml = chips.length ? `<div class="aui-chips">${chips.map(c => `<a class="aui-chip" href="${attr(c.href)}" aria-label="Remove filter ${attr(c.label)}">${escHtml(c.label)}<span aria-hidden="true">×</span></a>`).join('')}<a class="aui-chips__clear" href="${attr(gridUrl(o.baseUrl, { ...(o.keep || {}), view: state.view, d: state.d }, {}))}">Clear all</a></div>` : '';
  const densityHtml = `<div class="aui-density" role="group" aria-label="Row density"><a href="${attr(url({ d: '' }))}"${dense ? '' : ' aria-current="true"'}>Comfortable</a><a href="${attr(url({ d: 'compact' }))}"${dense ? ' aria-current="true"' : ''}>Compact</a></div>`;
  const toolbar = `<div class="aui-grid__toolbar" data-grid-toolbar>
    <form class="aui-grid__filters" method="get" action="${attr(o.baseUrl)}" role="search">${keep}${searchHtml}${selectsHtml}${chipsHtml}</form>
    <div class="aui-grid__tools">${densityHtml}${o.actionsHtml || ''}</div>
  </div>`;
  const bulkHtml = o.bulk?.length ? `<div class="aui-bulk" data-grid-bulk hidden role="toolbar" aria-label="Bulk actions">
    <span class="aui-bulk__count"><span data-bulk-count>0</span> selected</span>
    <div class="aui-bulk__actions">${o.bulk.map((b, i) => `<button type="button" class="aui-btn aui-btn--sm aui-btn--${i === 0 ? 'primary' : 'secondary'}" data-bulk-each="${attr(b.eachUrl)}" data-done="${attr(b.done || 'Done.')}"${b.confirm ? ` data-bulk-title="${attr(b.confirm.title)}" data-bulk-body="${attr(b.confirm.body || '')}"` : ''}>${escHtml(b.label)}</button>`).join('')}<button type="button" class="aui-btn aui-btn--sm aui-btn--ghost" data-bulk-clear>Clear</button></div>
  </div>` : '';

  // Head
  const hasBulk = !!o.bulk?.length, hasMenu = !!o.rowMenu;
  const span = cols.length + (hasBulk ? 1 : 0) + (hasMenu ? 1 : 0);
  const th = cols.map(c => {
    const cls = [c.num ? 'is-num' : '', c.phone === false ? 'is-desk' : ''].filter(Boolean).join(' ');
    const clsAttr = cls ? ` class="${cls}"` : '';
    if (!c.sort) return `<th${clsAttr} scope="col">${escHtml(c.label)}</th>`;
    const on = sortCol === c;
    const next = on ? (sortDir > 0 ? `-${c.key}` : c.key) : (c.num ? `-${c.key}` : c.key);
    return `<th${clsAttr} scope="col" aria-sort="${on ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}"><a class="aui-grid__sort${on ? ' is-on' : ''}" href="${attr(url({ sort: next, page: '' }))}">${escHtml(c.label)}<span aria-hidden="true">${on ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></a></th>`;
  }).join('');
  const head = `<thead><tr>${hasBulk ? '<th class="aui-grid__check"><input type="checkbox" data-bulk-all aria-label="Select all on this page"></th>' : ''}${th}${hasMenu ? '<th class="aui-grid__menu"><span class="sr-only">Actions</span></th>' : ''}</tr></thead>`;

  // Body
  const rowHtml = r => {
    const key = attr(o.rowKey(r));
    const tds = cols.map(c => {
      const cls = [c.num ? 'is-num' : '', c.nowrap ? 'is-nowrap' : '', c.phone === false ? 'is-desk' : '', c.primary ? 'is-primary' : '', c.bare ? 'is-bare' : ''].filter(Boolean).join(' ');
      let inner = c.cell(r);
      if (c.primary && o.expand) inner = `<button type="button" class="aui-grid__expand" data-grid-expand aria-expanded="false">${inner}</button>`;
      else if (c.primary && o.rowHref) inner = `<a class="aui-grid__link" href="${attr(o.rowHref(r))}">${inner}</a>`;
      return `<td${cls ? ` class="${cls}"` : ''} data-label="${attr(c.label)}">${inner}</td>`;
    }).join('');
    const menuCell = hasMenu ? `<td class="aui-grid__menu">${menu(o.rowMenu(r))}</td>` : '';
    const check = hasBulk ? `<td class="aui-grid__check"><input type="checkbox" data-bulk-row value="${key}" aria-label="Select row"></td>` : '';
    const more = o.expand ? `<tr class="aui-grid__more" hidden><td colspan="${span}"><div class="aui-grid__facts">${o.expand(r)}</div></td></tr>` : '';
    return `<tr class="aui-grid__row" data-key="${key}">${check}${tds}${menuCell}</tr>${more}`;
  };
  let body = '';
  if (o.groupBy) {
    let last = null;
    for (const r of pageRows) {
      const g = o.groupBy(r);
      if (g !== last) { body += `<tr class="aui-grid__group"><td colspan="${span}">${escHtml(g)}</td></tr>`; last = g; }
      body += rowHtml(r);
    }
  } else body = pageRows.map(rowHtml).join('');
  const foot = o.footer && pageRows.length ? `<tfoot>${o.footer(list)}</tfoot>` : '';

  const empty = !pageRows.length ? `<div class="aui-grid__empty">
      <div class="aui-empty__title">${escHtml(filtered ? `No ${many} match` : (o.empty?.title || `No ${many} yet`))}</div>
      <div class="aui-empty__sub">${escHtml(filtered ? 'Try another search, or clear the filters.' : (o.empty?.sub || ''))}</div>
      ${filtered ? `<a class="aui-btn aui-btn--sm aui-btn--secondary" href="${attr(o.baseUrl)}">Clear filters</a>` : ''}
    </div>` : '';
  const from = list.length ? (page - 1) * perPage + 1 : 0;
  const pager = `<div class="aui-grid__pager">
    <span>${list.length ? `${from}–${from + pageRows.length - 1} of ${list.length} ${list.length === 1 ? one : many}` : `0 ${many}`}</span>
    ${pages > 1 ? `<nav class="aui-pager" aria-label="Pages">
      ${page > 1 ? `<a class="aui-pager__btn" href="${attr(url({ page: page - 1 }))}" aria-label="Previous page">‹</a>` : '<span class="aui-pager__btn is-off" aria-hidden="true">‹</span>'}
      <span class="aui-pager__n">${page} / ${pages}</span>
      ${page < pages ? `<a class="aui-pager__btn" href="${attr(url({ page: page + 1 }))}" aria-label="Next page">›</a>` : '<span class="aui-pager__btn is-off" aria-hidden="true">›</span>'}
    </nav>` : ''}
  </div>`;

  return `<div class="aui-grid${dense ? ' is-dense' : ''}" id="${attr(o.id)}" data-grid>
    ${viewsHtml}${toolbar}${bulkHtml}
    <div class="aui-grid__card">
      ${pageRows.length ? `<div class="aui-grid__scroll"><table class="aui-grid__table">${head}<tbody>${body}</tbody>${foot}</table></div>` : ''}
      ${empty}${pager}
    </div>
  </div>`;
}

// ── Page structure ─────────────────────────────────────────────────────────────────────

// Tabs under a page header: [{ label, href, count, active }]
export function pageTabs(tabs) {
  return `<nav class="aui-tabs" aria-label="Sections">${tabs.map(t => `<a class="aui-tabs__tab${t.active ? ' is-active' : ''}" href="${attr(t.href)}"${t.active ? ' aria-current="page"' : ''}>${escHtml(t.label)}${t.count != null && t.count !== '' ? ` <span class="aui-views__n">${escHtml(t.count)}</span>` : ''}</a>`).join('')}</nav>`;
}

export function breadcrumb(items) {
  return `<nav class="aui-crumbs" aria-label="Breadcrumb">${items.map((it, i) => (it.href && i < items.length - 1 ? `<a href="${attr(it.href)}">${escHtml(it.label)}</a>` : `<span>${escHtml(it.label)}</span>`)).join('<span aria-hidden="true">/</span>')}</nav>`;
}

// ── Forms ──────────────────────────────────────────────────────────────────────────────

// A form block: label column left, fields right (stacks on a phone). Several go in a formCard.
export function formSection({ title, sub = '', bodyHtml }) {
  return `<div class="aui-fsec"><div class="aui-fsec__label"><div class="aui-fsec__title">${escHtml(title)}</div>${sub ? `<div class="aui-fsec__sub">${escHtml(sub)}</div>` : ''}</div><div class="aui-fsec__body">${bodyHtml}</div></div>`;
}
export function formCard(sectionsHtml) { return `<div class="aui-fcard">${sectionsHtml}</div>`; }
export function fieldGrid(fieldsHtml) { return `<div class="aui-fields">${fieldsHtml}</div>`; }

// One field. type: text | email | number | date | time | textarea | select | money
export function field({ label, name, value = '', type = 'text', help = '', error = '', options = [], rows = 3, placeholder = '', required = false, wide = false, attrs = '' }) {
  const id = `f-${String(name).replace(/[^a-z0-9_-]/gi, '')}`;
  const common = `id="${id}" name="${attr(name)}"${required ? ' required' : ''}${error ? ' aria-invalid="true"' : ''}${placeholder ? ` placeholder="${attr(placeholder)}"` : ''} ${attrs}`;
  let control;
  if (type === 'textarea') control = `<textarea class="aui-input" rows="${rows}" ${common}>${escHtml(value)}</textarea>`;
  else if (type === 'select') control = `<select class="aui-input" ${common}>${options.map(([v, l]) => `<option value="${attr(v)}"${String(v) === String(value) ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select>`;
  else if (type === 'money') control = `<span class="aui-input aui-input--affix"><span class="aui-input__pre">₱</span><input inputmode="decimal" value="${attr(value)}" ${common}></span>`;
  else control = `<input class="aui-input" type="${attr(type)}" value="${attr(value)}" ${common}>`;
  return `<label class="aui-field${wide ? ' is-wide' : ''}${error ? ' is-error' : ''}" for="${id}"><span class="aui-field__label">${escHtml(label)}</span>${control}${error ? `<span class="aui-field__error">${escHtml(error)}</span>` : help ? `<span class="aui-field__help">${escHtml(help)}</span>` : ''}</label>`;
}

export function segmented({ name, value, options, label = '' }) {
  return `<div class="aui-segmented" role="radiogroup"${label ? ` aria-label="${attr(label)}"` : ''}>${options.map(([v, l]) => `<label><input type="radio" name="${attr(name)}" value="${attr(v)}"${String(v) === String(value) ? ' checked' : ''}><span>${escHtml(l)}</span></label>`).join('')}</div>`;
}

// A switch row. With `post`, flipping it saves right away (JSON { key, on }, or { <name>: '1'|'0' }
// with `setting` for /admin/site/settings) and toasts;
// without, it fills a hidden input for the surrounding form.
export function toggleRow({ label, help = '', name, on = false, post = '', reload = false, setting = false }) {
  return `<div class="aui-toggle-row"><div><div class="aui-toggle-row__label">${escHtml(label)}</div>${help ? `<div class="aui-toggle-row__help">${escHtml(help)}</div>` : ''}</div>
    <button type="button" class="aui-switch" role="switch" aria-checked="${on}" aria-label="${attr(label)}" data-switch="${attr(name)}"${post ? ` data-switch-post="${attr(post)}"` : ''}${reload ? ' data-switch-reload' : ''}${setting ? ' data-switch-setting' : ''}><span></span></button>
    ${post ? '' : `<input type="hidden" name="${attr(name)}" value="${on ? '1' : '0'}">`}</div>`;
}

// Sticky bar that shows once a form marked data-dirty-watch changes.
export function saveBar({ label = 'Save', form = '' } = {}) {
  const f = form ? ` form="${attr(form)}"` : '';
  return `<div class="aui-savebar" data-savebar hidden><span><b>Unsaved changes</b></span><div class="aui-savebar__actions"><button type="reset"${f} class="aui-btn aui-btn--ghost">Discard</button><button type="submit"${f} class="aui-btn aui-btn--primary">${escHtml(label)}</button></div></div>`;
}

// Searchable people picker. options: [{ id, name, color, meta }]; selected: ids. Posts one
// hidden input per pick, named `name`.
export function playerPicker({ name, label, options, selected = [], multiple = true, placeholder = 'Type a name' }) {
  const data = escHtml(JSON.stringify(options.map(o => ({ id: String(o.id), name: o.name, color: o.color || '', meta: o.meta || '' }))));
  return `<div class="aui-field is-wide"><span class="aui-field__label">${escHtml(label)}</span>
    <div class="aui-picker" data-picker data-name="${attr(name)}" data-multiple="${multiple}" data-options="${data}" data-selected="${attr(JSON.stringify(selected.map(String)))}">
      <div class="aui-picker__box"><span class="aui-picker__chips" data-picker-chips></span><input type="text" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="${attr(label)}" placeholder="${attr(placeholder)}" data-picker-input autocomplete="off"></div>
      <div class="aui-picker__list" role="listbox" data-picker-list hidden></div>
      <span data-picker-values></span>
    </div></div>`;
}

// ── Feedback ───────────────────────────────────────────────────────────────────────────

export function banner(tone, text, actionHtml = '') {
  const icon = { warn: '!', info: 'i', ok: '✓', error: '!' }[tone] || 'i';
  return `<div class="aui-banner aui-banner--${tone}" role="status"><span class="aui-banner__mark" aria-hidden="true">${icon}</span><span class="aui-banner__text">${escHtml(text)}</span>${actionHtml}</div>`;
}

// A side drawer, opened by any element with data-drawer-open="<id>".
export function drawer({ id, eyebrow = '', title, bodyHtml, footerHtml = '' }) {
  return `<div class="aui-drawer" id="${attr(id)}" hidden data-drawer><div class="aui-drawer__backdrop" data-drawer-close></div>
    <aside class="aui-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="${attr(id)}-title">
      <div class="aui-drawer__head"><div>${eyebrow ? `<div class="aui-drawer__eyebrow">${escHtml(eyebrow)}</div>` : ''}<h2 class="aui-drawer__title" id="${attr(id)}-title">${escHtml(title)}</h2></div><button type="button" class="aui-drawer__close" aria-label="Close" data-drawer-close>×</button></div>
      <div class="aui-drawer__body">${bodyHtml}</div>
      ${footerHtml ? `<div class="aui-drawer__foot">${footerHtml}</div>` : ''}
    </aside></div>`;
}

// ── Detail blocks ──────────────────────────────────────────────────────────────────────

// One person and every admin page they appear on. links: [{ label, href, count, active }]
export function personStrip({ name, color = '', sub = '', badgeHtml = '', links = [] }) {
  return `<div class="aui-person"><div class="aui-person__who">${avatar(name, color, { size: 40 })}<div><div class="aui-person__name">${escHtml(name)}</div>${sub ? `<div class="aui-person__sub">${escHtml(sub)}</div>` : ''}</div>${badgeHtml}</div>
    <nav class="aui-person__links" aria-label="${attr(name)} across the admin">${links.filter(Boolean).map(l => `<a class="aui-person__link${l.active ? ' is-active' : ''}" href="${attr(l.href)}"${l.active ? ' aria-current="page"' : ''}>${escHtml(l.label)}${l.count ? ` <span class="aui-num">${escHtml(l.count)}</span>` : ''}</a>`).join('')}</nav></div>`;
}

// [[label, valueHtml]]: values are trusted HTML (escape before passing).
export function facts(pairs) {
  return `<dl class="aui-facts">${pairs.filter(Boolean).map(([k, v]) => `<div class="aui-facts__row"><dt>${escHtml(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

// [{ who, what, when, tone }]
export function timeline(items) {
  return `<ol class="aui-timeline">${items.map(i => `<li class="aui-timeline__item aui-timeline--${i.tone || 'gray'}"><span class="aui-timeline__dot" aria-hidden="true"></span><div><div class="aui-timeline__text"><b>${escHtml(i.who)}</b> ${escHtml(i.what)}</div><div class="aui-timeline__when">${escHtml(i.when)}</div></div></li>`).join('')}</ol>`;
}

// Small numbers inside a page: [{ label, value, of }]
export function statStrip(items) {
  return `<div class="aui-stats">${items.map(s => `<div class="aui-stats__cell"><div class="aui-stats__label">${escHtml(s.label)}</div><div class="aui-stats__value">${escHtml(s.value)}${s.of ? `<span>${escHtml(s.of)}</span>` : ''}</div></div>`).join('')}</div>`;
}
