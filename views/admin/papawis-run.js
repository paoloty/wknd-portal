// /admin/papawis/:id: one Papawis run (admin redesign, 2026-10-15; mockup: canvas "Papawis ·
// Run page"). Rebuilt from scratch on views/admin/ui.js; replaces the old single long page
// and the separate teams page. Tabs (?tab=): Roster, Teams, Money, Messages, Activity,
// Settings. Browser behaviour (drag to reorder, the price calculator, copy for Messenger,
// cover upload): public/admin-papawis.js. Every POST goes to the same routes as before.
import { escHtml } from '../layout.js';
import { displayPlayerName, formatTimeRange, isPapawisSignupOpenNow, depositPresets, manilaTodayStr } from '../utils.js';
import { CUTOFF_DAYS as PAPAWIS_CUTOFF_DAYS } from '../papawis.js';
import { parseHeightCm } from '../../lib/papawis-teams.js';
import {
  pageHeader, pageTabs, banner, statStrip, section, badge, button, menu, avatar, emptyState, timeline,
  playerPicker, field, fieldGrid, formCard, formSection, toggleRow,
} from './ui.js';
import { ACTIVITY_LABELS, REFEREE_RATE_DEFAULT, roundTo10, hoursBetween, estimateTotal, defaultPapawisPrice, hasSavedPapawisAmount } from './papawis.js';

const attr = s => escHtml(String(s ?? ''));
const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const fmtDate = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const fmtDay = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtStamp = ts => new Date(ts).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const fmtTime = ts => (ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '');
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const teamLabel = t => (t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : '');
const sideBadge = t => (t === 'light' ? '<span class="pw-side pw-side--light">Light</span>' : t === 'dark' ? '<span class="pw-side pw-side--dark">Dark</span>' : '<span class="aui-muted">—</span>');
const signupName = s => (s.guest_name ? s.guest_name : displayPlayerName(s.player_name));

// JSON body for data-post-json buttons.
const body = obj => `data-body="${attr(JSON.stringify(obj))}"`;
const postBtn = (label, url, { kind = 'secondary', size = 'sm', done = 'Done.', confirm = null, data = null, then = '', method = '' } = {}) =>
  button(label, { kind, size, attrs: `data-post-json="${attr(url)}" data-done="${attr(done)}"${data ? ` ${body(data)}` : ''}${then ? ` data-then="${attr(then)}"` : ''}${method ? ` data-method="${method}"` : ''}${confirm ? ` data-confirm data-confirm-title="${attr(confirm.title)}" data-confirm-body="${attr(confirm.body || '')}" data-confirm-send="${attr(confirm.send || label)}"${confirm.type ? ` data-confirm-type="${attr(confirm.type)}"` : ''}` : ''}` });

function runStatus(game, confirmedCount) {
  if (game.status === 'cancelled') return ['Cancelled', 'red'];
  if (game.status === 'completed') return ['Completed', 'gray'];
  if (!isPapawisSignupOpenNow(game)) return ['Scheduled', 'blue'];
  if (confirmedCount >= game.max_slots) return ['Full', 'amber'];
  return ['Open', 'green'];
}

// Paid status for a confirmed signup on a completed run, with the "possible match" and
// "one payment, two games" suggestions the old page had (see the route for how they're found).
export function paidCell(game, s, candidates = [], reusable = [], { unpaidBadge = true } = {}) {
  const unpaid = unpaidBadge ? badge('Unpaid', 'red') : '';
  const base = `/admin/papawis/${game.id}/signups/${s.id}`;
  if (s.paid_at) {
    return postBtn('Paid ✓', `${base}/paid`, { kind: 'done', data: { paid: false }, done: `${signupName(s)} marked unpaid.`,
      confirm: { title: 'Unmark as paid?', body: 'This voids the recorded payment in the ledger.', send: 'Unmark' } });
  }
  const mark = label => postBtn(label, `${base}/paid`, { kind: 'secondary', data: { paid: true }, done: `${signupName(s)} marked paid.` });
  const reuse = reusable.map(c => `<span class="pw-hint pw-hint--blue">Also covers ${peso(c.amount)} paid ${escHtml(fmtDay(c.date))}, already linked to ${escHtml(c.linked_game_title || 'another game')}
      ${postBtn('Link here too', `${base}/link-payment`, { kind: 'secondary', data: { tx_id: c.id }, done: 'Payment linked.' })}</span>`).join('');
  if (candidates.length === 1) {
    const c = candidates[0];
    // Same-day payment under another category (server.js pwPaymentCandidates): linking files it under Papawis.
    const other = /^papawis/i.test(String(c.category || '')) ? '' : String(c.category || 'no category');
    return `<div class="pw-paid">${unpaid}<span class="pw-hint">Possible match: ${peso(c.amount)} paid ${escHtml(fmtDay(c.date))}${other ? ` · filed as ${escHtml(other)}` : ''}</span>
      <span class="aui-row">${postBtn('Link', `${base}/link-payment`, { kind: 'primary', data: { tx_id: c.id }, done: other ? 'Payment linked and filed under Papawis.' : 'Payment linked.' })}${mark('Mark paid instead')}</span>${reuse}</div>`;
  }
  if (candidates.length > 1) {
    return `<div class="pw-paid">${unpaid}<a class="aui-link" href="/admin/ledger/${attr(s.player_id)}" target="_blank" rel="noopener">${candidates.length} unconfirmed payments: check the ledger</a>${mark('Mark paid')}${reuse}</div>`;
  }
  return `<div class="pw-paid">${unpaid}${reuse}${mark('Mark paid')}</div>`;
}

function rosterRow(game, s, { canManage, isConfirmedFull, n, colorByTeam, showPaid, unlinkedByPlayer, reusableByPlayer }) {
  const name = signupName(s);
  const canNotify = canManage && !s.guest_name && s.status === 'confirmed' && s.team && s.reminder_sent_at && !s.team_notified_at;
  const att = s.status === 'confirmed' ? { noshow: 'No-show', dnp: 'DNP' }[s.attendance] || '' : '';
  const sub = s.guest_name ? `Guest of ${displayPlayerName(s.player_name)}` : (s.team_name || '');
  const canMark = game.status !== 'cancelled' && String(game.date) <= manilaTodayStr();
  // One visible action at most (Confirm, for the waitlist); the rest live in the ⋯ menu.
  const actions = [];
  if (canManage && s.status === 'waitlist') {
    actions.push(isConfirmedFull ? button('Confirm', { kind: 'secondary', size: 'sm', attrs: 'disabled title="Confirmed is full"' })
      : postBtn('Confirm', `/admin/papawis/${game.id}/signups/${s.id}/status`, { data: { status: 'confirmed' }, done: `${name} moved to confirmed.` }));
  }
  const menuItems = [
    canNotify ? { label: `Email their team (${teamLabel(s.team)})`, post: `/admin/papawis/${game.id}/signups/${s.id}/notify-team`, done: `${name} emailed their team.`,
      confirm: { title: `Email ${name} that they’re on Team ${teamLabel(s.team)}?`, body: 'Their reminder went out before teams were set. This is a one-time catch-up email.', send: 'Send email' } } : null,
    canManage && s.status === 'confirmed' ? { label: 'Move to the waitlist', post: `/admin/papawis/${game.id}/signups/${s.id}/status`, body: { status: 'waitlist' }, done: `${name} moved to the waitlist.` } : null,
    // No-show / DNP, on the day or after (also closed out): both still charged.
    ...(canMark && s.status === 'confirmed' ? [
      s.attendance !== 'noshow' ? { label: 'Mark as no-show', post: `/admin/papawis/${game.id}/signups/${s.id}/attendance`, body: { mark: 'noshow' }, done: `${name} marked no-show (still charged).` } : null,
      s.attendance !== 'dnp' ? { label: 'Mark as DNP', post: `/admin/papawis/${game.id}/signups/${s.id}/attendance`, body: { mark: 'dnp' }, done: `${name} marked DNP (still charged).` } : null,
      s.attendance ? { label: 'Mark as played', post: `/admin/papawis/${game.id}/signups/${s.id}/attendance`, body: { mark: '' }, done: `${name} marked played.` } : null,
    ] : []),
    !s.guest_name && s.player_id ? { label: 'Open player', href: `/admin/players/${s.player_id}` } : null,
    canManage ? 'sep' : null,
    canManage ? { label: 'Remove…', danger: true, post: `/admin/papawis/${game.id}/remove/${s.id}`, done: `${name} removed.`,
      confirm: { title: `Remove ${name}?`, body: s.status === 'confirmed' ? 'The first person on the waitlist moves up.' : 'They come off the waitlist.', send: 'Remove' } } : null,
  ].filter(Boolean);
  const cleanMenu = menuItems.filter((m, i, a) => !(m === 'sep' && (i === 0 || i === a.length - 1)));
  const side = s.status === 'confirmed' ? s.team : '';
  return `<tr class="aui-grid__row"${canManage ? ' draggable="true"' : ''} data-id="${attr(s.id)}" data-status="${attr(s.status)}" data-name="${attr(name)}" data-paid="${s.paid_at ? 1 : 0}">
    <td class="pw-roster__n">${canManage ? '<span class="pw-handle" aria-hidden="true" title="Drag to reorder">⠿</span>' : ''}<span class="aui-num">${n}</span></td>
    <td class="is-primary" data-label="Player"><span class="aui-who">${avatar(name, s.guest_name ? '' : colorByTeam[s.team_name] || '', { playerId: s.guest_name ? '' : s.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}${att ? ` ${badge(att, att === 'No-show' ? 'red' : 'gray')}` : ''}</span>${sub ? `<span class="aui-cell__sub">${escHtml(sub)}</span>` : ''}</span>${side ? `<span class="pw-side-inline">${sideBadge(side)}</span>` : ''}</span></td>
    <td class="is-bare is-desk" data-label="Side">${sideBadge(side)}</td>
    ${showPaid ? `<td class="is-bare" data-label="Paid">${paidCell(game, s, (unlinkedByPlayer[s.player_id] || []), (reusableByPlayer[s.player_id] || []))}</td>` : ''}
    <td class="is-num is-desk" data-label="Signed up">${escHtml(fmtTime(s.signed_up_at))}</td>
    <td class="pw-roster__actions">${actions.join('')}</td>
    <td class="aui-grid__menu">${menu(cleanMenu)}</td>
  </tr>`;
}

function rosterTable(game, groups, opts) {
  const head = `<thead><tr><th class="pw-roster__n">#</th><th>Player</th><th>Side</th>${opts.showPaid ? '<th>Paid</th>' : ''}<th class="is-num is-desk">Signed up</th><th></th><th class="aui-grid__menu"><span class="sr-only">Actions</span></th></tr></thead>`;
  const span = opts.showPaid ? 7 : 6;
  const bodies = groups.map(g => `<tbody data-roster-list="${g.status}"${opts.canManage ? ' data-dnd' : ''}>
      <tr class="aui-grid__group"><td colspan="${span}">${escHtml(g.label)}</td></tr>
      ${g.rows.length ? g.rows.map((s, i) => rosterRow(game, s, { ...opts, n: i + 1 })).join('') : `<tr class="pw-roster__empty"><td colspan="${span}">${escHtml(g.empty)}</td></tr>`}
    </tbody>`).join('');
  return `<div class="aui-grid__card"><div class="aui-grid__scroll"><table class="aui-grid__table pw-roster">${head}${bodies}</table></div>
    ${opts.canManage ? '<div class="aui-grid__pager"><span>Drag ⠿ to reorder or move between lists: the order is the slot order.</span></div>' : ''}</div>`;
}

function pendingDeposits(game, pending, minDeposit, unconfirmedDepositByPlayer) {
  if (!pending.length) return '';
  const presets = depositPresets(minDeposit);
  const rows = pending.map(s => {
    const name = signupName(s);
    const tx = unconfirmedDepositByPlayer[s.player_id];
    const base = `/admin/papawis/${game.id}/signups/${s.id}`;
    const submitted = tx ? `<div class="pw-hint pw-hint--green">Submitted ${peso(tx.amount)} via ${escHtml(tx.payment_method || 'settle-balance')}${tx.reference_no ? ` · ref ${escHtml(tx.reference_no)}` : ''}, pending review
        ${postBtn('Confirm and list', `${base}/confirm-deposit`, { kind: 'primary', data: { tx_id: tx.id }, done: `${name} listed.`, confirm: { title: `Confirm ${name}’s ${peso(tx.amount)} deposit?`, body: 'They move into Confirmed or the waitlist, whichever is open.', send: 'Confirm' } })}</div>` : '';
    const manual = `<form class="aui-inline-form" data-json-action="${base}/confirm-deposit" data-done="${attr(name)} listed." data-confirm data-confirm-title="Confirm this deposit and list ${attr(name)}?" data-confirm-send="Confirm">
        <select class="aui-input" name="amount" data-deposit-select data-min="${minDeposit || 0}" aria-label="Deposit amount" style="width:auto">
          ${presets.map(p => `<option value="${p.amount}">${peso(p.amount)}${p.detail ? ` · ${escHtml(p.detail)}` : ''}</option>`).join('')}
          <option value="__other__">Other amount…</option>
        </select>
        <input class="aui-input" type="number" name="amount_other" min="${minDeposit || 0}" step="1" placeholder="₱ amount" data-deposit-other hidden style="width:110px">
        <span class="aui-muted" data-deposit-detail></span>
        ${button(tx ? 'Use a different amount' : 'Confirm and list', { kind: tx ? 'secondary' : 'primary', size: 'sm', type: 'submit' })}
      </form>`;
    return `<div class="pw-pending">
      <div class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}</span><span class="aui-cell__sub">Awaiting a deposit (probation)</span></div>
      <div class="aui-stack" style="gap:8px">${submitted}${manual}</div>
      ${postBtn('Remove', `/admin/papawis/${game.id}/remove/${s.id}`, { kind: 'danger', done: `${name} removed.`, confirm: { title: `Remove ${name}?`, send: 'Remove' } })}
    </div>`;
  }).join('');
  return section({ title: `Pending deposit · ${pending.length}`, note: `· held until you confirm a deposit of at least ${peso(minDeposit)}`, bodyHtml: `<div class="aui-panel aui-panel--accent aui-stack">${rows}</div>` });
}

function addPlayerPanel(game, players, colorById) {
  return section({
    title: 'Add a player or guest',
    asideHtml: postBtn('Autofill regulars', `/admin/papawis/${game.id}/autofill-regulars`, { kind: 'secondary', done: 'Regulars added.',
      confirm: { title: 'Add the regulars who aren’t listed yet?', body: 'Skips anyone already listed, on probation, with an unpaid balance or without an active account. Fills Confirmed first, then the waitlist.', send: 'Autofill' } }),
    bodyHtml: `<form class="aui-panel" data-json-action="/admin/papawis/${attr(game.id)}/add" data-done="Added.">
      ${fieldGrid(`${playerPicker({ name: 'player_id', label: 'Player', multiple: false, placeholder: 'Type a name',
          options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: colorById[p.id] || '', meta: p.team_name || '' })) })}
        ${field({ label: 'Guests of this player (optional)', name: 'guest_names', placeholder: 'e.g. Bryan, Mark', help: 'Comma-separated. Filled in = adds their guests, billed to them.' })}
        ${field({ label: 'Add to', name: 'status', type: 'select', options: [['confirmed', 'Confirmed'], ['waitlist', 'Waitlist']] })}`)}
      <div class="aui-row" style="margin-top:14px">${button('Add', { kind: 'primary', size: 'sm', type: 'submit' })}</div>
    </form>`,
  });
}

function teamsTab(game, roster, { isOpen, isLocked, teamsVisible, confirmedCount }) {
  if (!isOpen) return emptyState({ title: 'Teams are only for upcoming runs', sub: 'This run is over.' });
  if (isLocked) return emptyState({ title: 'The roster is locked', sub: 'Unlock it from the top of the page to change teams.' });
  if (!roster.length) return emptyState({ title: 'No confirmed players yet', sub: 'Teams are built from the confirmed list.' });
  const hasTeams = roster.some(r => r.team);
  const visibility = teamsVisible ? banner('ok', 'Players can see the teams now.')
    : banner('info', `Players can’t see the teams yet: the run needs to be full (${confirmedCount}/${game.max_slots}) and within ${PAPAWIS_CUTOFF_DAYS} days.`);
  if (!hasTeams) {
    return `${visibility}${emptyState({ title: 'Teams aren’t built yet', sub: 'Balanced by position and height; guests are placed randomly.' })}
      <form method="get" action="/admin/papawis/${attr(game.id)}/teams" data-confirm data-confirm-title="Build the teams now?" data-confirm-body="Each confirmed player gets a bell notification with their team." data-confirm-send="Build teams" style="display:flex;justify-content:center">${button('Build teams', { kind: 'primary', type: 'submit' })}</form>`;
  }
  const item = r => {
    let pos = []; try { pos = JSON.parse(r.positions || '[]'); } catch { /* none */ }
    const h = parseHeightCm(r.height);
    const name = r.guest_name || displayPlayerName(r.player_name);
    return `<li class="pw-team__row" draggable="true" data-id="${attr(r.id)}" data-team="${attr(r.team || '')}">
      <span class="pw-handle" aria-hidden="true">⠿</span>
      <span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}${r.guest_name ? ' <span class="aui-muted">guest</span>' : ''}</span><span class="aui-cell__sub">${escHtml([pos.join('/'), h ? `${Math.round(h)} cm` : ''].filter(Boolean).join(' · ') || '—')}</span></span>
    </li>`;
  };
  const col = (team, label) => {
    const rows = roster.filter(r => r.team === team);
    return `<section class="pw-team pw-team--${team}"><header class="pw-team__head"><span class="pw-side pw-side--${team}">${label}</span><span class="aui-num">${rows.length}</span></header>
      <ul class="pw-team__list" data-team-list="${team}">${rows.map(item).join('') || '<li class="pw-team__empty">Drop players here</li>'}</ul></section>`;
  };
  const unassigned = roster.filter(r => r.team !== 'light' && r.team !== 'dark');
  return `${visibility}
    <div class="aui-row-between"><span class="aui-muted">Drag a player across to swap sides. Saves as you drop.</span>
      ${postBtn('Reshuffle', `/admin/papawis/${game.id}/teams/reshuffle`, { done: 'Teams reshuffled.', confirm: { title: 'Reshuffle both sides from scratch?', body: 'Any swaps you made by hand are lost.', send: 'Reshuffle' } })}</div>
    ${unassigned.length ? banner('warn', `${plural(unassigned.length, 'player')} not on a side yet. Drag them into Light or Dark.`) : ''}
    <div class="pw-teams">${col('light', 'Light')}${col('dark', 'Dark')}</div>
    ${unassigned.length ? `<section class="pw-team"><header class="pw-team__head"><span>Unassigned</span></header><ul class="pw-team__list" data-team-list="">${unassigned.map(item).join('')}</ul></section>` : ''}`;
}

function moneyTab(game, { confirmed, isOpen, isCompleted, courtRate, unlinkedByPlayer, reusableByPlayer, colorByTeam }) {
  if (game.status === 'cancelled') return emptyState({ title: 'Cancelled', sub: 'No charges were made for this run.' });
  if (isCompleted) {
    const paid = confirmed.filter(s => s.paid_at).length;
    const breakdown = game.actual_total
      ? `${peso(game.court_rate_per_hour)}/hr × ${game.session_hours || 0} h${game.has_referee ? ` + referee ${peso(game.referee_rate_per_hour)}/hr × ${game.session_hours || 0} h` : ''} = ${peso(game.actual_total)}${game.min_per_player ? ` · minimum ${peso(game.min_per_player)} per player` : ''}` : '';
    return `${statStrip([{ label: 'Per player', value: peso(game.price_per_player) }, { label: 'Charged', value: String(confirmed.length) }, { label: 'Paid', value: String(paid), of: `/${confirmed.length}` },
        { label: 'Still owed', value: peso((confirmed.length - paid) * (game.price_per_player || 0)) }])}
      ${breakdown ? `<p class="aui-muted" style="margin:0">${escHtml(breakdown)}</p>` : ''}
      ${section({ title: 'Payments', asideHtml: postBtn('Email payment reminders', `/admin/papawis/${game.id}/send-payment-emails`, { done: 'Payment emails sent.',
          confirm: { title: `Email everyone charged (${confirmed.length}) their total?`, body: 'Each gets what they owe for this run and a link to settle up. Nobody is charged again.', send: 'Send emails' } }),
        bodyHtml: rosterTable(game, [{ status: 'confirmed', label: `Charged · ${confirmed.length}`, rows: confirmed, empty: 'Nobody was charged.' }],
          { canManage: false, showPaid: true, isConfirmedFull: true, colorByTeam, unlinkedByPlayer, reusableByPlayer }) })}`;
  }
  // Open run: the close-out calculator (public/admin-papawis.js keeps the numbers live).
  const saved = hasSavedPapawisAmount(game);
  const rate = game.court_rate_per_hour || courtRate || '';
  const hours = game.session_hours || hoursBetween(game.start_time, game.end_time) || '';
  const hasRef = saved ? !!game.has_referee : true;
  const refRate = game.referee_rate_per_hour || REFEREE_RATE_DEFAULT;
  const total = estimateTotal({ rate: Number(rate) || 0, hours: Number(hours) || 0, hasReferee: hasRef, refereeRate: refRate });
  const price = total && confirmed.length ? roundTo10(total / confirmed.length) : defaultPapawisPrice(confirmed.length);
  return `<div class="aui-cols">
    <div class="aui-cols__main">
      ${section({ title: 'Price', note: `· split across ${plural(confirmed.length, 'confirmed player')}`, bodyHtml: `<div class="aui-panel" data-calc data-count="${confirmed.length}" data-game="${attr(game.id)}">
        ${fieldGrid(`${field({ label: 'Court rate (₱/hr)', name: 'court_rate', type: 'number', value: rate, attrs: 'data-calc-rate min="0" step="1"' })}
          ${field({ label: 'Hours', name: 'hours', type: 'number', value: hours, attrs: 'data-calc-hours min="0" step="0.25"' })}
          ${field({ label: 'Referee rate (₱/hr)', name: 'referee_rate', type: 'number', value: refRate, attrs: `data-calc-ref min="0" step="1"${hasRef ? '' : ' disabled'}` })}
          ${field({ label: 'Minimum per player (optional)', name: 'min_per_player', type: 'number', value: game.min_per_player || '', attrs: 'data-calc-min min="0" step="1"' })}`)}
        <label class="aui-check" style="margin-top:12px;width:max-content"><input type="checkbox" data-calc-hasref${hasRef ? ' checked' : ''}><span>Referee for this session</span></label>
        <dl class="pw-calc">
          <div><dt>Court</dt><dd data-calc-out="court">₱0</dd></div>
          <div data-calc-refrow${hasRef ? '' : ' hidden'}><dt>Referee</dt><dd data-calc-out="ref">₱0</dd></div>
          <div class="pw-calc__total"><dt>Actual total</dt><dd data-calc-out="total">₱0</dd></div>
          <div><dt>÷ ${confirmed.length || 0} players</dt><dd data-calc-out="raw">₱0</dd></div>
        </dl>
        <div class="aui-row" style="margin-top:12px">${button('Save details', { kind: 'secondary', size: 'sm', attrs: 'data-calc-save' })}<span class="aui-muted">Lets the reminder email quote this estimate. Doesn’t charge anyone.</span></div>
      </div>` })}
    </div>
    <aside class="aui-cols__side">
      ${section({ title: 'After the game', bodyHtml: `<div class="aui-panel aui-panel--accent aui-stack">
        ${field({ label: 'Price per player (final, adjust freely)', name: 'price', type: 'money', value: price || '', attrs: 'data-calc-price' })}
        <p class="aui-muted" style="margin:0">Close out marks the run completed and charges every confirmed player this price.</p>
        ${button('Close out and charge…', { kind: 'primary', attrs: 'data-calc-complete' })}
      </div>` })}
    </aside>
  </div>`;
}

function messagesTab(game, broadcast, { isOpen, isLocked, isCompleted }) {
  const parts = [];
  if (isOpen && broadcast) {
    const { state, preview, regularsRule } = broadcast;
    const scheduled = game.announce_send_at && !game.announced_at && game.announce_send_at > Date.now();
    let status, action = '', tone = 'gray';
    if (isLocked) status = 'The roster is locked, so there’s nothing to announce.';
    else if (scheduled) {
      status = `Scheduled for ${fmtStamp(game.announce_send_at)}, when sign-ups open.${state.production ? '' : ' Scheduled sends only run on the live site.'}`; tone = 'blue';
      action = postBtn('Cancel scheduled announcement', `/admin/papawis/${game.id}/announce/cancel`, { done: 'Scheduled announcement cancelled.' });
    } else if (game.announced_at) {
      status = `Announced ${fmtStamp(game.announced_at)}: ${plural(game.announced_count || 0, 'email')} sent.`; tone = 'green';
      action = postBtn('Announce again', `/admin/papawis/${game.id}/announce`, { done: 'Announced again.', confirm: { title: 'Announce this run again?', body: 'Regulars who aren’t on the roster get another email.', send: 'Announce again' } });
    } else {
      status = 'Regulars haven’t heard about this run.'; tone = 'amber';
      const n = preview?.total || 0, e = preview?.emailable || 0;
      action = postBtn(game.open_days_before ? 'Announce at sign-up open' : `Announce to ${plural(n, 'regular')}`, `/admin/papawis/${game.id}/announce`, { kind: 'primary', done: 'Announcement sent.',
        confirm: { title: `Announce ${game.title || 'this run'} to ${plural(n, 'regular')}?`, body: `Bell to ${n}, email to ${e}. Regulars already on the roster are skipped.`, send: 'Announce', type: e > 40 ? String(e) : '' } });
    }
    const reach = preview && !game.announced_at && !isLocked
      ? `<p class="aui-muted" style="margin:0">${plural(preview.total, 'regular')} · ${preview.emailable} by email · ${preview.optedOut} bell only · ${(preview.noValidEmail || 0) + (preview.dormant || 0)} skipped</p>` : '';
    parts.push(section({ title: 'New-run announcement', bodyHtml: `<div class="aui-panel aui-stack">
      <div class="aui-row">${badge(game.announced_at ? 'Announced' : scheduled ? 'Scheduled' : isLocked ? 'Locked' : 'Not announced', tone)}<span class="aui-muted">${escHtml(status)}</span></div>
      ${reach}
      ${preview && !game.announced_at && !isLocked ? `<p class="aui-muted" style="margin:0">Regulars = played ${escHtml(regularsRule)}.${preview.settle ? ` ${preview.settle} get a “settle your unpaid game first” line.` : ''}${preview.deposit ? ` ${preview.deposit} need a deposit first.` : ''}</p>` : ''}
      ${action ? `<div class="aui-row">${action}</div>` : ''}
    </div>` }));
    const alerts = broadcast.alerts || [];
    const off = !state.slotAlertsEnabled ? 'Slot-opened alerts are off. Turn them on from the Runs page.' : !state.production ? 'Slot-opened alerts only send from the live site.' : '';
    const groupText = (count, sentAt, label) => (sentAt == null ? '' : count < 0 ? `${label}: skipped, slots filled first` : `${label}: ${count} emailed ${fmtStamp(sentAt)}`);
    const items = alerts.map(a => ({
      who: a.open_slots ? `${plural(a.open_slots, 'slot')} opened` : 'A slot opened', tone: 'blue', when: fmtStamp(a.created_at),
      what: [a.group1_sent_at == null ? `regulars at ${fmtStamp(a.group1_at)}` : groupText(a.group1_count, a.group1_sent_at, 'regulars'),
        a.group2_at == null ? '' : a.group2_sent_at == null ? `viewers at ${fmtStamp(a.group2_at)} if still open` : groupText(a.group2_count, a.group2_sent_at, 'viewers')].filter(Boolean).join(' · '),
    }));
    parts.push(section({ title: 'Slot-opened alerts', bodyHtml: `<div class="aui-panel">${off ? `<p class="aui-muted" style="margin:0 0 ${items.length ? 12 : 0}px">${escHtml(off)}</p>` : ''}${items.length ? timeline(items) : (off ? '' : '<p class="aui-muted" style="margin:0">None for this run.</p>')}</div>` }));
  }
  parts.push(section({ title: isCompleted ? 'Payment status for Messenger' : 'Roster for Messenger',
    bodyHtml: `<div class="aui-panel aui-row-between"><span class="aui-muted">${isCompleted ? 'Copies the numbered list with ✅ / ❌ for who has paid.' : 'Copies the sign-up post with every slot numbered and the waitlist.'}</span>${button('Copy to clipboard', { kind: 'secondary', size: 'sm', attrs: 'data-copy-messenger' })}</div>` }));
  return parts.join('');
}

function activityTab(activity) {
  if (!activity.length) return emptyState({ title: 'No activity yet', sub: 'Sign-ups, cancellations and emails show up here.' });
  const tone = t => ({ joined: 'green', promoted: 'green', cancelled: 'red', cancel_notified: 'red', waitlisted: 'amber', registered: 'amber' }[t] || 'gray');
  return `<div class="aui-panel">${timeline(activity.map(e => ({
    who: e.player_name ? displayPlayerName(e.player_name) : 'Someone', what: `${(ACTIVITY_LABELS[e.event_type] || { label: e.event_type }).label}${e.notes ? ` (${e.notes})` : ''}`, when: fmtTime(e.created_at), tone: tone(e.event_type),
  })))}</div>`;
}

function settingsTab(game, courts, { isOpen }) {
  const known = courts.some(c => c.name === game.location);
  const court = courts.find(c => c.name === game.location);
  const details = `<form id="pw-details" data-json-action="/admin/papawis/${attr(game.id)}/location" data-done="Run details saved.">${fieldGrid(`
      ${field({ label: 'Court', name: 'location', type: 'select', attrs: 'data-other-toggle', value: known ? game.location : (game.location ? '__other__' : ''),
        options: [['', 'Select a court…'], ...courts.map(c => [c.name, c.name]), ['__other__', 'Other…']] })}
      ${field({ label: 'Other location', name: 'location_other', value: known ? '' : (game.location || ''), attrs: `data-other-field${known || !game.location ? ' hidden' : ''}` })}
      ${field({ label: 'Start', name: 'start_time', type: 'time', value: game.start_time || '' })}
      ${field({ label: 'End', name: 'end_time', type: 'time', value: game.end_time || '' })}
      ${field({ label: 'Max players', name: 'max_slots', type: 'number', value: game.max_slots || 10, attrs: 'min="1" step="1"' })}`)}
      <div class="aui-row" style="margin-top:14px">${button('Save details', { kind: 'primary', size: 'sm', type: 'submit' })}
      ${game.location && !court?.image_url ? postBtn('Refresh map', `/admin/papawis/${game.id}/refresh-map`, { kind: 'ghost', done: 'Map ready. Refresh the public page to see it.' }) : ''}</div>
    </form>`;
  const cover = `<div class="pw-cover" data-cover data-game="${attr(game.id)}">
      <div class="pw-cover__frame"${game.cover_ver ? '' : ' hidden'} data-cover-frame><img alt="" data-cover-img src="${game.cover_ver ? `/api/papawis-cover/${attr(encodeURIComponent(game.id))}?v=${attr(encodeURIComponent(game.cover_ver))}` : ''}"></div>
      <div class="aui-row">
        <label class="aui-btn aui-btn--secondary aui-btn--sm" for="pw-cover-input">${game.cover_ver ? 'Replace cover' : 'Upload cover'}</label>
        <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-cover-remove${game.cover_ver ? '' : ' hidden'}>Remove</button>
        <span class="aui-muted" data-cover-msg></span>
      </div>
      <input type="file" id="pw-cover-input" accept="image/*" hidden data-cover-input>
    </div>`;
  const timing = isOpen ? toggleRow({ label: 'Hold sign-ups until 6 days before', help: game.open_days_before ? `Sign-ups open ${fmtDay(addDays(game.date, -game.open_days_before))}, 8:00 AM. The run still shows publicly as Scheduled.` : 'Sign-ups are open now.',
    name: 'countdown', on: !!game.open_days_before, post: `/admin/papawis/${game.id}/toggle-countdown`, reload: true }) : '';
  const danger = `<div class="aui-stack">
      ${isOpen ? `<div class="aui-row-between"><span class="aui-cell__stack"><span class="aui-cell__title">Cancel this run</span><span class="aui-cell__sub">Nobody is charged. With reminder emails on, everyone listed gets a cancellation email.</span></span>
        ${postBtn('Cancel run…', `/admin/papawis/${game.id}/cancel`, { kind: 'danger', done: 'Run cancelled.', confirm: { title: 'Cancel this run?', body: 'Nobody is charged. Everyone listed is told if reminder emails are on.', send: 'Cancel run' } })}</div>` : ''}
      <div class="aui-row-between"><span class="aui-cell__stack"><span class="aui-cell__title">Delete this run</span><span class="aui-cell__sub">Removes the run and every sign-up. Can’t be undone.</span></span>
        ${postBtn('Delete run…', `/admin/papawis/${game.id}`, { kind: 'danger', method: 'DELETE', then: '/admin/papawis', done: 'Run deleted.', confirm: { title: 'Delete this run for good?', body: 'All sign-ups go with it. This can’t be undone.', send: 'Delete' } })}</div>
    </div>`;
  return formCard([
    formSection({ title: 'Run details', sub: 'Court, time and size. Players with a time or court change get told if reminder emails are on.', bodyHtml: details }),
    isOpen ? formSection({ title: 'Sign-up timing', bodyHtml: timing }) : '',
    formSection({ title: 'Cover', sub: 'Leads the homepage banner and /papawis instead of the court photo. Cropped to 16:9.', bodyHtml: cover }),
    formSection({ title: 'Danger zone', bodyHtml: danger }),
  ].join(''));
}

export function adminPapawisRunBody({
  game, signups = [], players = [], activity = [], daysLeft = Infinity, unlinkedByPlayer = {}, reusableByPlayer = {}, courtRate = null,
  minDeposit = null, unconfirmedDepositByPlayer = {}, courts = [], broadcast = null, tab = 'roster', teamRoster = [], colorByTeam = {}, colorById = {}, ver = '',
}) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const waitlist = signups.filter(s => s.status === 'waitlist');
  const pending = signups.filter(s => s.status === 'pending');
  const isOpen = game.status === 'open', isCompleted = game.status === 'completed';
  const isLocked = !!game.signups_locked_at;
  const canManage = isOpen && !isLocked;
  const isConfirmedFull = confirmed.length >= game.max_slots;
  const scheduled = isOpen && !isPapawisSignupOpenNow(game);
  const [statusLabel, statusTone] = runStatus(game, confirmed.length);
  const time = formatTimeRange(game.start_time, game.end_time) || game.time_label || '';
  const sub = [fmtDate(game.date), time, game.location || 'No court set', isCompleted ? `${peso(game.price_per_player)} per player` : ''].filter(Boolean).join(' · ');

  // Confirmed players whose reminder went out before teams were set (same rule as the row's
  // "Email their team"). Works while locked too: emailing doesn't change the roster.
  const teamCatchUp = isOpen ? confirmed.filter(s => !s.guest_name && s.team && s.reminder_sent_at && !s.team_notified_at).length : 0;
  const canAnnounce =isOpen && !isLocked && !game.announced_at && !(game.announce_send_at && game.announce_send_at > Date.now()) && !isConfirmedFull;
  const actions = [
    button('View on site ↗', { kind: 'ghost', href: `/papawis#pw-game-${game.id}`, attrs: 'target="_blank" rel="noopener"' }),
    isOpen ? postBtn(isLocked ? 'Unlock roster' : 'Lock roster', `/admin/papawis/${game.id}/${isLocked ? 'unlock' : 'lock'}`, { kind: 'secondary', size: '', done: isLocked ? 'Roster unlocked.' : 'Roster locked.',
      confirm: isLocked ? { title: 'Unlock the roster?', body: 'Sign-ups and teams become editable again.', send: 'Unlock' } : { title: 'Lock the roster?', body: 'Sign-ups and teams freeze until you unlock. Do this once you’ve sent the list out.', send: 'Lock' } }) : '',
  ].join('');

  const banners = [
    isOpen && isLocked ? banner('warn', 'The roster is locked: sign-ups and team changes are frozen.') : '',
    scheduled ? banner('info', `Sign-ups open ${fmtDay(addDays(game.date, -game.open_days_before))}, 8:00 AM. Until then the run shows as Scheduled.`) : '',
    canAnnounce && !scheduled && tab !== 'messages' ? banner('warn', 'Not announced yet: regulars haven’t heard about this run.', `<a class="aui-link" href="/admin/papawis/${attr(game.id)}?tab=messages">Open messages</a>`) : '',
    teamCatchUp && (tab === 'roster' || tab === 'teams') ? banner('info', `${plural(teamCatchUp, 'player')} got their reminder before teams were set.`,
      postBtn(`Email their teams (${teamCatchUp})`, `/admin/papawis/${game.id}/notify-teams`, { kind: 'primary', done: 'Team emails sent.',
        confirm: { title: `Email ${plural(teamCatchUp, 'player')} their team?`, body: 'Each gets their side (Light or Dark) and teammates, plus a bell. One-time: anyone already emailed their team is skipped.', send: 'Send emails' } })) : '',
    isOpen && pending.length && tab !== 'roster' ? banner('warn', `${plural(pending.length, 'player')} waiting on a deposit.`, `<a class="aui-link" href="/admin/papawis/${attr(game.id)}">Open roster</a>`) : '',
  ].join('');

  const paidCount = confirmed.filter(s => s.paid_at).length;
  const stats = statStrip([
    { label: 'Confirmed', value: String(confirmed.length), of: `/${game.max_slots}` },
    { label: 'Waitlist', value: String(waitlist.length) },
    isOpen && pending.length ? { label: 'Pending deposit', value: String(pending.length) } : null,
    isCompleted ? { label: 'Paid', value: String(paidCount), of: `/${confirmed.length}` } : null,
    isCompleted ? { label: 'Per player', value: peso(game.price_per_player) } : { label: daysLeft >= 0 ? 'Starts' : 'Played', value: daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : daysLeft > 0 ? `in ${daysLeft} days` : `${-daysLeft} days ago` },
  ].filter(Boolean));

  const tabs = [
    ['roster', 'Roster', confirmed.length + waitlist.length + pending.length],
    isOpen ? ['teams', 'Teams', ''] : null,
    ['money', 'Money', ''],
    ['messages', 'Messages', ''],
    ['activity', 'Activity', ''],
    ['settings', 'Settings', ''],
  ].filter(Boolean);
  const current = tabs.some(t => t[0] === tab) ? tab : 'roster';
  const tabsHtml = pageTabs(tabs.map(([k, label, count]) => ({ label, count, href: `/admin/papawis/${game.id}${k === 'roster' ? '' : `?tab=${k}`}`, active: k === current })));

  const rosterOpts = { canManage, isConfirmedFull, colorByTeam, showPaid: false, unlinkedByPlayer, reusableByPlayer };
  const content = {
    roster: () => [
      isOpen ? pendingDeposits(game, pending, minDeposit, unconfirmedDepositByPlayer) : '', // confirming a deposit works while locked too
      rosterTable(game, [
        { status: 'confirmed', label: `Confirmed · ${confirmed.length}/${game.max_slots}`, rows: confirmed, empty: 'No one confirmed yet.' },
        { status: 'waitlist', label: `Waitlist · ${waitlist.length}`, rows: waitlist, empty: 'Nobody waiting.' },
      ], rosterOpts),
      canManage ? addPlayerPanel(game, players, colorById) : '',
    ].join(''),
    teams: () => teamsTab(game, teamRoster, { isOpen, isLocked, confirmedCount: confirmed.length, teamsVisible: isConfirmedFull && daysLeft <= PAPAWIS_CUTOFF_DAYS }),
    money: () => moneyTab(game, { confirmed, isOpen, isCompleted, courtRate, unlinkedByPlayer, reusableByPlayer, colorByTeam }),
    messages: () => messagesTab(game, broadcast, { isOpen, isLocked, isCompleted }),
    activity: () => activityTab(activity),
    settings: () => settingsTab(game, courts, { isOpen }),
  }[current]();

  // What public/admin-papawis.js needs (Copy for Messenger reads the roster rows on the page).
  const config = { id: game.id, date: game.date, start_time: game.start_time || '', end_time: game.end_time || '', location: game.location || '', max_slots: game.max_slots,
    completed: isCompleted, confirmed: confirmed.map(signupName), waitlist: waitlist.map(signupName), paid: confirmed.map(s => !!s.paid_at) };
  return `<div class="aui-page" id="pw-run" data-config="${attr(JSON.stringify(config))}">
    ${pageHeader({ title: game.title || 'Papawis', sub, actionsHtml: actions })}
    <div class="aui-row" style="margin-top:-10px">${badge(statusLabel, statusTone)}</div>
    ${banners}
    ${current === 'money' && isCompleted ? '' : stats}
    ${tabsHtml}
    ${content}
  </div>
  <script src="/admin-papawis.js${ver ? `?v=${ver}` : ''}" defer></script>`;
}
