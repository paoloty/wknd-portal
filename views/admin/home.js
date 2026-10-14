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
    ? `<div class="ahome-item__chips">${it.chips.map(c => badge(`${c.ok ? '✓' : '✕'} ${c.label}`, c.ok ? 'green' : 'red')).join('')}</div>`
    : '';
  return `<article class="ahome-item${hot ? ' is-hot' : ''}${it.done ? ' is-done' : ''}" data-item data-cat="${attr(it.cat)}">
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

function todoSection(items, snoozedCount) {
  const open = items.filter(i => !i.done);
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
      ${items.map(todoItem).join('')}
      <div data-empty${items.length ? ' hidden' : ''}>${emptyState({ title: 'You’re all caught up', sub: 'Nothing here needs you right now.', done: true })}</div>
    </div>
  </section>`;
}

function quietSection(quiet) {
  if (!quiet?.list?.length) return '';
  const rows = quiet.list.map(p => `<tr>
    <td><span class="aui-who">${avatar(p.name, p.color)}${escHtml(p.name)}</span></td>
    <td>${escHtml(p.usually)}</td>
    <td class="aui-num">${escHtml(p.lastSeen)}</td>
    <td>${p.nudgedAgo
      ? button(`Nudged ${p.nudgedAgo} ago`, { kind: 'done', size: 'sm', attrs: 'disabled' })
      : `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${p.name}?`, body: `A bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge' })}><input type="hidden" name="ids" value="${attr(p.id)}">${button('Nudge', { kind: 'secondary', size: 'sm', type: 'submit' })}</form>`}</td>
  </tr>`).join('');
  const todo = quiet.list.filter(p => !p.nudgedAgo);
  const all = todo.length > 1
    ? `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${todo.length} quiet regulars?`, body: `Each gets a bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge all' })}>${todo.map(p => `<input type="hidden" name="ids" value="${attr(p.id)}">`).join('')}<button type="submit" class="aui-link">Nudge all ${todo.length}</button></form>`
    : '';
  return section({
    title: 'Slipping away',
    note: `· regulars not seen for ${quiet.days}+ days`,
    asideHtml: all,
    bodyHtml: `<div class="aui-table-wrap"><table class="aui-table">
      <thead><tr><th>Player</th><th>Usually</th><th>Last seen</th><th><span class="sr-only">Nudge</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
  });
}

function feedSection(feed, now) {
  const body = feed.length
    ? `<div class="ahome-feed">${feed.map(f => `<div class="ahome-feed__row">
        ${avatar(f.name, f.color, { size: 26 })}
        <div class="ahome-feed__text"><b>${escHtml(f.name)}</b> ${escHtml(f.what)}</div>
        <span class="ahome-feed__ago">${ago(f.at, now)}</span>
      </div>`).join('')}</div>`
    : emptyState({ title: 'Quiet so far', sub: 'Picks, Papawis sign-ups, comments and shares show up here.' });
  return section({ title: 'Live', asideHtml: '<span class="ahome-live">Players, not admins</span>', bodyHtml: body });
}

export function adminHomeBody({ eyebrow, sub, kpis = [], items = [], snoozedCount = 0, quiet = null, feed = [], now = Date.now() }) {
  return `<div class="ahome">
    ${pageHeader({ eyebrow, title: 'This week', sub })}
    ${kpis.length ? `<div class="aui-kpis">${kpis.map(kpi).join('')}</div>` : ''}
    <div class="ahome__cols">
      <div class="ahome__main">
        ${todoSection(items, snoozedCount)}
        ${quietSection(quiet)}
      </div>
      <div class="ahome__side">${feedSection(feed, now)}</div>
    </div>
  </div>`;
}
