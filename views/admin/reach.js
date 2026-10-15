// Message players (admin redesign, 2026-10-15; mockup: canvas "Composer"). One message to a
// group: a bell on the site and, if wanted, an email. Every send goes through
// lib/broadcast.js sendBroadcast, so the same per-player email caps, unsubscribes and the
// Sent log apply as for the automatic reminders.
//   /admin/reach        the composer: who (segment), how (bell / bell + email), message
//   /admin/reach/sent   every group send, automatic or by hand, with opens and clicks
// Browser side (live counts, previews, test send, confirm text): public/admin-reach.js.
import { escHtml } from '../layout.js';
import { pageHeader, pageTabs, dataGrid, badge, field, segmented, playerPicker, banner, emptyState } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

function tabs(active, sentCount) {
  return pageTabs([
    { label: 'Compose', href: '/admin/reach', active: active === 'compose' },
    { label: 'Sent', href: '/admin/reach/sent', count: sentCount, active: active === 'sent' },
  ]);
}

const header = (title = 'Message players', sub = 'One message to a group: a bell on the site, and an email if you want. Same caps and unsubscribes as the automatic reminders.') =>
  pageHeader({ eyebrow: 'Reach', title, sub });

// The "Who it reaches" rows; public/admin-reach.js refills them from /admin/reach/count.
export function reachRows(r, withEmail) {
  const rows = [
    ['bell', 'Bell notifications', r.bell, ''],
    ['email', 'Emails', withEmail ? r.email : '—', ''],
    ['bellOnly', 'Bell only: opted out or shared inbox', withEmail ? r.bellOnly : '—', 'is-muted'],
    ['capped', 'Bell only: had a group email today or 3 this week', withEmail ? r.capped : '—', 'is-muted'],
    ['skipped', 'Skipped: no valid email, not approved or away 90+ days', r.skipped, 'is-faint'],
  ];
  return rows.map(([k, l, v, cls]) => `<div class="reach-row ${cls}"><span>${escHtml(l)}</span><b data-reach-n="${k}">${escHtml(v)}</b></div>`).join('');
}

export function adminReachComposeBody({ segments, seg, teams, team, pickOptions, picked, ch, counts, links, sentCount, isDev, myEmail }) {
  const segList = segments.map(s => `<label class="aui-choice reach-seg">
      <input type="radio" name="seg" value="${attr(s.key)}"${s.key === seg ? ' checked' : ''}${s.disabled ? ' disabled' : ''}>
      <span class="aui-choice__body${s.disabled ? ' is-disabled' : ''}">
        <span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(s.label)}</span><span class="aui-cell__sub">${escHtml(s.help)}</span></span>
        <span class="reach-seg__n" data-seg-n="${attr(s.key)}">${s.disabled ? '—' : s.n}</span>
      </span></label>`).join('');

  const teamChips = `<div class="reach-teams" data-reach-show="team"${seg === 'team' ? '' : ' hidden'}>${teams.map(t => `<label class="reach-chip">
      <input type="radio" name="team" value="${attr(t.id)}"${t.id === team ? ' checked' : ''}>
      <span><i style="background:${attr(t.color)}"></i>${escHtml(t.name)}</span></label>`).join('')}</div>`;

  const picker = `<div data-reach-show="pick"${seg === 'pick' ? '' : ' hidden'}>${playerPicker({ name: 'ids[]', label: 'Players', options: pickOptions, selected: picked, placeholder: 'Type a name to add…' })}</div>`;

  const withEmail = ch === 'both';
  const firstCta = links[0]?.cta || 'Open WKND';
  const form = `<form id="reach-form" class="aui-cols" data-json-action="/admin/reach/send" data-then="/admin/reach/sent" data-done="Sent."
      data-confirm data-confirm-title="Send this message?" data-confirm-body="" data-confirm-send="Send" data-links="${attr(JSON.stringify(links))}">
    <div class="aui-cols__main">
      <section class="aui-panel reach-step">
        <h2 class="reach-step__title">1 · Who</h2>
        <div class="aui-choices aui-choices--rows">${segList}</div>
        ${teamChips}
        ${picker}
      </section>
      <section class="aui-panel reach-step">
        <h2 class="reach-step__title">2 · How</h2>
        ${segmented({ name: 'ch', value: ch, label: 'Channel', options: [['bell', 'Bell only'], ['both', 'Bell + email']] })}
      </section>
      <section class="aui-panel reach-step">
        <h2 class="reach-step__title">3 · Message</h2>
        <div class="aui-fields">
          ${field({ label: 'Headline (the bell, and the email subject)', name: 'title', wide: true, required: true, placeholder: 'Who wins? Sunday’s picks close at 1 PM', attrs: 'maxlength="90" data-reach-title' })}
          <label class="aui-field is-wide" for="f-body"><span class="aui-field__label">Message</span>
            <textarea class="aui-input" rows="4" id="f-body" name="body" maxlength="400" placeholder="What do you want them to know or do?" data-reach-body></textarea>
            <span class="aui-field__help"><span data-reach-bodycount>0</span> / 400 · the bell shows the first line</span></label>
          ${field({ label: 'Tap goes to', name: 'link', type: 'select', value: links[0]?.value || '/', options: links.map(l => [l.value, l.label]), attrs: 'data-reach-link' })}
          <div data-reach-show-email${withEmail ? '' : ' hidden'}>${field({ label: 'Button on the email', name: 'cta', value: firstCta, attrs: 'maxlength="40" data-reach-cta' })}</div>
          <div class="is-wide" data-reach-other hidden>${field({ label: 'Other link', name: 'link_other', placeholder: '/games or https://wkndbasketball.com/…', help: 'A page on the site.' })}</div>
        </div>
      </section>
      <div class="aui-panel reach-sendbar">
        <span class="reach-sendbar__sum" data-reach-summary></span>
        <span class="reach-sendbar__btns">
          <button type="button" class="aui-btn aui-btn--secondary" data-reach-test title="${attr(myEmail ? `Bell and email to ${myEmail}` : 'Email to the admin inbox')}">Send test to me</button>
          <button type="submit" class="aui-btn aui-btn--primary" data-reach-send>Send</button>
        </span>
      </div>
    </div>
    <aside class="aui-cols__side">
      ${isDev ? `<div class="reach-dev">${banner('info', 'Not the live site: at most one email goes out, and it lands in the admin inbox.')}</div>` : ''}
      <section class="aui-panel aui-panel--flush reach-who">
        <h2 class="reach-side__title">Who it reaches</h2>
        <div class="reach-rows" data-reach-rows>${reachRows(counts, withEmail)}</div>
      </section>
      <section class="reach-prev">
        <h2 class="reach-side__title reach-side__title--out">Bell preview</h2>
        <div class="reach-bell"><span class="reach-bell__logo" aria-hidden="true">W</span>
          <span class="aui-cell__stack"><span class="aui-cell__title" data-prev-title>Your headline</span><span class="aui-cell__sub" data-prev-first>The first line of your message</span></span>
          <span class="reach-bell__when">now</span></div>
      </section>
      <section class="reach-prev" data-reach-show-email${withEmail ? '' : ' hidden'}>
        <h2 class="reach-side__title reach-side__title--out">Email preview</h2>
        <div class="reach-mail">
          <div class="reach-mail__brand">WKND LEAGUE</div>
          <div class="reach-mail__body">
            <div class="reach-mail__title" data-prev-title>Your headline</div>
            <div class="reach-mail__text" data-prev-body>Your message</div>
            <span class="reach-mail__cta"><span data-prev-cta>${escHtml(firstCta)}</span> →</span>
          </div>
          <div class="reach-mail__foot">WKND Basketball League · Unsubscribe</div>
        </div>
      </section>
    </aside>
  </form>
  <script src="/admin-reach.js" defer></script>`;

  return `<div class="aui-page">${header()}${tabs('compose', sentCount)}${form}</div>`;
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');

// rows: [{ id, title, kindLabel, segLabel, by, auto, bell, taps, email, opened, clicked, created_at, whenLabel }]
export function adminReachSentBody({ rows, query, sentCount }) {
  const empty = { title: 'Nothing sent yet', sub: 'Group sends show up here: the automatic reminders and anything you send from Compose.' };
  const grid = dataGrid({
    id: 'reach-sent', baseUrl: '/admin/reach/sent', query,
    rows, rowKey: r => r.id,
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'auto', label: 'Automatic', test: r => r.auto },
      { key: 'hand', label: 'By hand', test: r => !r.auto },
    ],
    search: { placeholder: 'Search messages', text: r => `${r.title} ${r.kindLabel} ${r.segLabel} ${r.by}` },
    columns: [
      { key: 'title', label: 'Message', primary: true, sort: r => r.title.toLowerCase(),
        cell: r => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.title || '(no headline)')}</span><span class="aui-cell__sub">${escHtml(r.kindLabel)}</span></span>` },
      { key: 'to', label: 'Sent to', phone: false, cell: r => escHtml(r.segLabel) },
      { key: 'by', label: 'By', bare: true, cell: r => badge(r.auto ? 'Automatic' : r.by, r.auto ? 'blue' : 'gray') },
      { key: 'bell', label: 'Bells', num: true, phone: true, sort: r => r.bell, cell: r => String(r.bell) },
      { key: 'taps', label: 'Tapped', num: true, phone: false, sort: r => (r.bell ? r.taps / r.bell : -1), cell: r => pct(r.taps, r.bell) },
      { key: 'email', label: 'Emails', num: true, phone: true, sort: r => r.email, cell: r => String(r.email) },
      { key: 'opened', label: 'Opened', num: true, phone: false, sort: r => (r.email ? r.opened / r.email : -1), cell: r => pct(r.opened, r.email) },
      { key: 'clicked', label: 'Clicked', num: true, phone: false, sort: r => (r.email ? r.clicked / r.email : -1), cell: r => pct(r.clicked, r.email) },
      { key: 'when', label: 'When', nowrap: true, phone: true, sort: r => r.created_at, cell: r => escHtml(r.whenLabel) },
    ],
    defaultSort: '-when', perPage: 25,
    empty, noun: ['send', 'sends'],
  });
  return `<div class="aui-page">${header('Sent log', '')}${tabs('sent', sentCount)}
    <p class="reach-note">Every group send, automatic or by hand. Opens and clicks fill in as people read them. Apple Mail counts some unread emails as opened.</p>
    ${rows.length ? grid : emptyState(empty)}</div>`;
}
