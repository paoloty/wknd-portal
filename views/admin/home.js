// Engagement Home (admin redesign step 1, 2026-10-15): replaces the old /admin dashboard.
// A to-do list sorted by what moves engagement most, the week's numbers, members slipping
// away and what players are doing right now. Data: buildAdminHome() in server.js.
// Mockup: https://claude.ai/artifact/D7GHyahGnTcs69a94FAsNP (direction A + C's to-do list).
import { escHtml } from '../layout.js';
import { pageHeader, section, kpi, badge, progress, button, emptyState, avatar, ago } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

const FILTERS = [['all', 'All'], ['eng', 'Engagement'], ['appr', 'Approvals'], ['money', 'Money']];

// data-confirm attributes for a send. Above 40 emails the count has to be typed.
function confirmAttrs(c) {
  if (!c) return '';
  return `data-confirm data-confirm-title="${attr(c.title)}" data-confirm-body="${attr(c.body)}"${c.type ? ` data-confirm-type="${attr(c.type)}"` : ''}${c.send ? ` data-confirm-send="${attr(c.send)}"` : ''}`;
}

function actionHtml(a, hot) {
  if (!a) return '';
  const kind = a.kind || (hot ? 'primary' : 'secondary');
  if (a.type === 'form') {
    const fields = Object.entries(a.fields || {}).flatMap(([k, v]) => [].concat(v).map(x => `<input type="hidden" name="${attr(k)}" value="${attr(x)}">`)).join('');
    return `<form method="post" action="${attr(a.url)}" ${confirmAttrs(a.confirm)}>${fields}${button(a.label, { kind, size: 'sm', type: 'submit' })}</form>`;
  }
  if (a.type === 'json') {
    return button(a.label, { kind, size: 'sm', attrs: `data-post-json="${attr(a.url)}" data-then="/admin" data-done="${attr(a.done || 'Done.')}" ${confirmAttrs(a.confirm)}` });
  }
  return button(a.label, { kind, size: 'sm', href: a.href });
}

function todoItem(it) {
  const hot = it.hot && !it.done;
  const chips = it.chips?.length
    ? `<div class="ahome-item__chips">${it.chips.filter(c => !c.ok).map(c => badge(`✕ ${c.label}`, 'red')).join('')}</div>`
    : '';
  return `<article class="ahome-item${hot ? ' is-hot' : ''}${it.done ? ' is-done' : ''}"${it.done ? '' : ` data-item data-cat="${attr(it.cat)}"`}>
    <span class="ahome-item__tag" aria-hidden="true">${escHtml(it.tag)}</span>
    <div class="ahome-item__body">
      <div class="ahome-item__top"><span class="ahome-item__title">${escHtml(it.title)}</span>${it.due ? badge(it.due, hot ? 'amber' : it.done ? 'green' : 'gray') : ''}</div>
      ${it.text ? `<span class="ahome-item__text">${escHtml(it.text)}</span>` : ''}
      ${it.pct != null ? progress(it.pct, { label: it.meta || '' }) : ''}
      ${chips}
    </div>
    <div class="ahome-item__actions">
      ${it.done ? '' : button('Later', { kind: 'ghost', size: 'sm', attrs: `data-snooze="${attr(it.key)}" aria-label="Snooze till tomorrow: ${attr(it.title)}"` })}
      ${actionHtml(it.action, hot)}
    </div>
  </article>`;
}

// Finished to-dos (already reminded or nudged) fold into one closed "Done" line at the end,
// outside the filters.
function todoSection(items, snoozedCount) {
  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  const count = cat => open.filter(i => cat === 'all' || i.cat === cat).length;
  const filters = `<div class="aui-seg" role="tablist" aria-label="Filter the to-do list" data-filter-group="ahome-todo">
    ${FILTERS.map(([k, l], i) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${i === 0}">${l} <span data-count>${count(k)}</span></button>`).join('')}
  </div>`;
  return `<section class="aui-section">
    <div class="aui-section__head">
      <h2 class="aui-section__title">To do <span class="ahome__count" data-count-total>${open.length}</span>${snoozedCount ? `<span class="aui-section__note">· ${snoozedCount} snoozed till tomorrow</span>` : ''}</h2>
      ${filters}
    </div>
    <div class="ahome-todo" id="ahome-todo">
      ${open.map(todoItem).join('')}
      <div data-empty${open.length ? ' hidden' : ''}>${emptyState({ title: 'You’re all caught up', sub: 'Nothing here needs you right now.', done: true })}</div>
      ${done.length ? `<details class="ahome-done"><summary class="ahome-done__sum"><span>Done</span><span class="aui-views__n">${done.length}</span><span class="ahome-done__hint">already reminded or nudged</span></summary><div class="ahome-todo">${done.map(todoItem).join('')}</div></details>` : ''}
    </div>
  </section>`;
}

function quietSection(quiet) {
  if (!quiet?.list?.length) return '';
  const rows = quiet.list.map(p => `<tr>
    <td><span class="aui-who">${avatar(p.name, p.color, { playerId: p.id })}${escHtml(p.name)}</span></td>
    <td class="ahome-desk">${escHtml(p.usually)}</td>
    <td class="aui-num">${escHtml(p.lastSeen)}</td>
    <td>${p.nudgedAgo
      ? button(p.nudgedAgo === 'just now' ? 'Nudged just now' : `Nudged ${p.nudgedAgo} ago`, { kind: 'done', size: 'sm', attrs: 'disabled' })
      : `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${p.name}?`, body: `A bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge' })}><input type="hidden" name="ids" value="${attr(p.id)}">${button('Nudge', { kind: 'secondary', size: 'sm', type: 'submit' })}</form>`}</td>
  </tr>`).join('');
  const todo = quiet.list.filter(p => !p.nudgedAgo);
  const all = todo.length > 1
    ? `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${todo.length} quiet regulars?`, body: `Each gets a bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge all' })}>${todo.map(p => `<input type="hidden" name="ids" value="${attr(p.id)}">`).join('')}<button type="submit" class="aui-link ahome-tap">Nudge all ${todo.length}</button></form>`
    : '';
  return section({
    title: 'Slipping away',
    note: `· regulars not seen for ${quiet.days}+ days`,
    asideHtml: all,
    bodyHtml: `<div class="aui-table-wrap"><table class="aui-table">
      <thead><tr><th>Player</th><th class="ahome-desk">Usually</th><th>Last seen</th><th><span class="sr-only">Nudge</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
  });
}

function feedSection(feed, now) {
  const body = feed.length
    ? `<div class="ahome-feed">${feed.map(f => `<div class="ahome-feed__row">
        ${avatar(f.name, f.color, { size: 26, playerId: f.playerId })}
        <div class="ahome-feed__text"><b>${escHtml(f.name)}</b> ${escHtml(f.what)}</div>
        <span class="ahome-feed__ago">${ago(f.at, now)}</span>
      </div>`).join('')}</div>`
    : emptyState({ title: 'Quiet so far', sub: 'Picks, Papawis sign-ups, comments and shares show up here.' });
  return section({ title: 'Live', asideHtml: '<span class="ahome-live">Players, not admins</span>', bodyHtml: body });
}

// Calls to action on the public site (join card, Messenger, Facebook): clicks in the last
// 30 days, logged by POST /api/cta/:key. Guest views of player pages give the join card a rate.
function clicksSection(clicks) {
  if (!clicks) return '';
  const rate = (key, views) => {
    const n = clicks.rows.find(r => r.key === key)?.n || 0;
    return views ? `${((n / views) * 100).toFixed(1)}%` : '—';
  };
  const lead = (label, value) => `<div class="ahome-clicks__row ahome-clicks__row--lead"><span>${escHtml(label)}</span><b>${value}</b></div>`;
  // Grouped by the page before the " · " in each label, busiest group first, busiest row first.
  const groups = {};
  for (const r of clicks.rows) {
    const [page, ...rest] = r.label.split(' · ');
    (groups[page] ??= []).push({ ...r, short: rest.join(' · ') || page });
  }
  const ordered = Object.entries(groups).map(([page, rows]) => ({ page, rows: rows.sort((x, y) => y.n - x.n), total: rows.reduce((t, r) => t + r.n, 0) }))
    .sort((x, y) => y.total - x.total);
  const groupHtml = ordered.map(g => `<div class="ahome-clicks__group"><div class="ahome-clicks__head"><span>${escHtml(g.page)}</span><b>${g.total}</b></div>
      ${g.rows.map(r => `<div class="ahome-clicks__row"><span>${escHtml(r.short)}</span><b>${r.n}</b></div>`).join('')}</div>`).join('');
  return section({ title: 'Site clicks', note: '· last 30 days', bodyHtml: `<div class="ahome-clicks">
    ${lead('Guest views of player pages', clicks.guestPlayerViews)}
    ${lead('Player page join rate', rate('player-join', clicks.guestPlayerViews))}
    ${lead('Guest views of court pages', clicks.guestCourtViews ?? 0)}
    ${lead('Court page sign-up rate', rate('court-signup', clicks.guestCourtViews))}
    ${groupHtml}
  </div>` });
}

export function adminHomeBody({ eyebrow, sub, kpis = [], items = [], snoozedCount = 0, quiet = null, feed = [], clicks = null, now = Date.now() }) {
  return `<div class="ahome">
    ${pageHeader({ eyebrow, title: 'This week', sub })}
    ${kpis.length ? `<div class="aui-kpis">${kpis.map(kpi).join('')}</div>` : ''}
    <div class="ahome__cols">
      <div class="ahome__main">
        ${todoSection(items, snoozedCount)}
        ${quietSection(quiet)}
      </div>
      <div class="ahome__side">${feedSection(feed, now)}${clicksSection(clicks)}</div>
    </div>
  </div>`;
}
