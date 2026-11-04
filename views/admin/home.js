// Engagement Home (admin redesign step 1, 2026-10-15): replaces the old /admin dashboard.
// A to-do list sorted by what moves engagement most, the week's numbers, members slipping
// away and what players are doing right now. Data: buildAdminHome() in server.js.
// Mockup: https://claude.ai/artifact/D7GHyahGnTcs69a94FAsNP (direction A + C's to-do list).
import { escHtml } from '../layout.js';
import { analyticsHomeSection } from './analytics.js';
import { pageHeader, section, kpi, badge, progress, button, emptyState, avatar, ago } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

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
  const chips = it.chips?.length ? `<span class="ahome-item__chips">${it.chips.filter(c => !c.ok).map(c => badge(`✕ ${c.label}`, 'red')).join('')}</span>` : '';
  return `<article class="aui-needs__row ahome-row${it.done ? ' is-done' : ''}"${it.done ? '' : ` data-item data-cat="${attr(it.cat)}"`}>
    <div class="ahome-row__main">
      <span class="ahome-row__title">${escHtml(it.title)}${it.due ? badge(it.due, hot ? 'amber' : it.done ? 'green' : 'gray') : ''}</span>
      ${it.text ? `<span class="aui-cell__sub">${escHtml(it.text)}</span>` : ''}
      ${it.pct != null ? progress(it.pct, { label: it.meta || '' }) : ''}
      ${chips}
    </div>
    <div class="ahome-row__actions">
      ${it.done ? '' : button('Later', { kind: 'ghost', size: 'sm', attrs: `data-snooze="${attr(it.key)}" aria-label="Snooze till tomorrow: ${attr(it.title)}"` })}
      ${actionHtml(it.action, hot)}
    </div>
  </article>`;
}

// Finished to-dos (already reminded or nudged) fold into one closed "Done" line at the end.
function todoSection(items, snoozedCount) {
  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  return section({
    title: 'Needs you',
    note: snoozedCount ? `· ${snoozedCount} snoozed till tomorrow` : '',
    bodyHtml: `<div class="aui-needs" id="ahome-todo">
      ${open.map(todoItem).join('')}
      <div data-empty${open.length ? ' hidden' : ''}>${emptyState({ title: 'You’re all caught up', sub: 'Nothing here needs you right now.', done: true })}</div>
      ${done.length ? `<details class="ahome-done"><summary class="ahome-done__sum"><span>Done</span><span class="aui-views__n">${done.length}</span><span class="ahome-done__hint">already reminded or nudged</span></summary>${done.map(todoItem).join('')}</details>` : ''}
    </div>`,
  });
}

function quietSection(quiet) {
  if (!quiet?.list?.length) return '';
  const rows = quiet.list.map(p => `<div class="aui-needs__row ahome-row">
    <div class="ahome-row__who">${avatar(p.name, p.color, { playerId: p.id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(p.name)}</span><span class="aui-cell__sub">${escHtml(p.usually)} · ${escHtml(p.lastSeen)}</span></span></div>
    <div class="ahome-row__actions">${p.nudgedAgo
      ? button(p.nudgedAgo === 'just now' ? 'Nudged just now' : `Nudged ${p.nudgedAgo} ago`, { kind: 'done', size: 'sm', attrs: 'disabled' })
      : `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${p.name}?`, body: `A bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge' })}><input type="hidden" name="ids" value="${attr(p.id)}">${button('Nudge', { kind: 'secondary', size: 'sm', type: 'submit' })}</form>`}</div>
  </div>`).join('');
  const todo = quiet.list.filter(p => !p.nudgedAgo);
  const all = todo.length > 1
    ? `<form method="post" action="/admin/home/nudge" ${confirmAttrs({ title: `Nudge ${todo.length} quiet regulars?`, body: `Each gets a bell notification: “${quiet.message.title}. ${quiet.message.body}”`, send: 'Nudge all' })}>${todo.map(p => `<input type="hidden" name="ids" value="${attr(p.id)}">`).join('')}<button type="submit" class="aui-link ahome-tap">Nudge all ${todo.length}</button></form>`
    : '';
  return section({ title: 'Slipping away', note: `· regulars not seen for ${quiet.days}+ days`, asideHtml: all, bodyHtml: `<div class="aui-needs">${rows}</div>` });
}

// Super admin only, because it comes from the logs. Each line opens the matching log view.
function problemsSection(p) {
  if (!p || !(p.emails + p.errors + p.requests)) return '';
  const line = (n, one, many, sub, href) => (n ? `<a class="aui-action" href="${href}"><span class="aui-cell__stack"><span class="aui-action__label">${n} ${n === 1 ? one : many}</span>${sub ? `<span class="aui-cell__sub ahome-problem__sub">${escHtml(sub)}</span>` : ''}</span>${badge('Open', 'red')}</a>` : '');
  return section({
    title: 'Went wrong', note: '· last 7 days',
    bodyHtml: `<div class="aui-panel aui-panel--flush">
      ${line(p.emails, 'email failed or bounced', 'emails failed or bounced', '', '/admin/logs?view=failed&area=Email')}
      ${line(p.requests, 'admin action crashed', 'admin actions crashed', '', '/admin/logs?view=failed')}
      ${line(p.errors, 'server error', 'server errors', p.latestError, '/admin/logs?view=failed&area=System')}
    </div>`,
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
  return section({ title: 'Live', note: '· players, not admins', bodyHtml: body });
}

export function adminHomeBody({ eyebrow, sub, kpis = [], items = [], snoozedCount = 0, quiet = null, feed = [], clicks = null, problems = null, now = Date.now() }) {
  return `<div class="ahome">
    ${pageHeader({ eyebrow, title: 'This week', sub })}
    ${kpis.length ? `<div class="aui-kpis">${kpis.map(kpi).join('')}</div>` : ''}
    <div class="ahome__cols">
      <div class="ahome__main">
        ${todoSection(items, snoozedCount)}
        ${problemsSection(problems)}
        ${quietSection(quiet)}
      </div>
      <div class="ahome__side">${feedSection(feed, now)}${analyticsHomeSection(clicks)}</div>
    </div>
  </div>`;
}
