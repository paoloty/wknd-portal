// /admin/ledger and /admin/ledger/:id (admin redesign, 2026-10-15; mockup: canvas "Ledger").
// Rebuilt from scratch on views/admin/ui.js. The list page: owed / credit / collected / to
// confirm tiles, payments waiting for a confirm (oldest first), every player's all-time
// balance on the shared data grid, the player in a drawer (?player=<id>) and one "Charge or
// record payment" drawer. The player page is the full history on the same kit. Browser
// side: public/admin-ui.js (actions, toasts, in-place refresh) + public/admin-ledger.js.
import { escHtml } from '../layout.js';
import { displayPlayerName, PAYMENT_CATEGORIES } from '../utils.js';
import { outlineDarkRings } from './season-teams.js';
import { pageHeader, dataGrid, section, badge, button, drawer, field, fieldGrid, segmented, menu, avatar, playerPicker, breadcrumb, personStrip, progress } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const EPS = 0.005;
const money = n => Math.abs(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const peso = n => `₱${money(n)}`;
const METHODS = [['cash', 'Cash'], ['gcash', 'GCash'], ['bank', 'Bank transfer'], ['other', 'Other']];
const methodLabel = m => (METHODS.find(([k]) => k === m) || [null, m || ''])[1];
const thisYear = new Date().getFullYear();
const fmtDate = d => {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', dt.getFullYear() === thisYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmtStamp = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

// Balance convention (player_financials / getAllBalances): positive = owes, negative = credit.
export function balanceText(b) {
  const n = Number(b) || 0;
  return n > EPS ? `Owes ${peso(n)}` : n < -EPS ? `Credit ${peso(n)}` : 'Settled';
}
const balanceTone = b => (b > EPS ? 'aui-neg' : b < -EPS ? 'aui-pos' : 'aui-muted');

// The season param: missing → the latest ledger season; '' or 'all' → all time.
const seasonParam = season => (season ? String(season) : 'all');
const seasonLabel = season => (season ? `Season ${season}` : 'All time');

// Only http(s), relative and data:image screenshots are ever linked, and always through the
// /admin/ledger/transaction/:id/screenshot route — the stored value never lands in the page.
export function isSafeScreenshot(u) {
  const s = String(u || '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return true;
  // Same rule as the screenshot route: no "//", no "/\", no spaces or control characters.
  return !/[\s\x00-\x1f\x7f\\]/.test(s) && (/^https?:\/\/[^/]/i.test(s) || /^\/(?![/\\])/.test(s));
}
const shotLink = tx => (isSafeScreenshot(tx.screenshot_url)
  ? `<a class="aui-link" href="/admin/ledger/transaction/${encodeURIComponent(tx.id)}/screenshot" target="_blank" rel="noopener">Screenshot</a>`
  : '');

// Canonical category for a stored value ("papawis" → "Papawis"); '' when it isn't one of ours.
const canonCategory = c => PAYMENT_CATEGORIES.find(x => x.toLowerCase() === String(c || '').trim().replace(/[_-]+/g, ' ').toLowerCase()) || '';

function seasonSwitch(hrefFor, seasons, season) {
  const opts = [['', 'All time'], ...seasons.map(s => [s, `S${s}`])];
  return `<nav class="alg-seasons" aria-label="Season">${opts.map(([v, l]) => {
    const on = String(v) === String(season);
    return `<a class="alg-seasons__opt${on ? ' is-on' : ''}" href="${attr(hrefFor(seasonParam(v)))}"${on ? ' aria-current="true"' : ''}>${escHtml(l)}</a>`;
  }).join('')}</nav>`;
}

// Tiles: the kit's stat strip cells, with a tone and a quiet second line.
function tiles(items, cls = '') {
  return `<div class="aui-stats alg-stats${cls ? ` ${cls}` : ''}">${items.map(t => `<div class="aui-stats__cell">
      <div class="aui-stats__label">${escHtml(t.label)}</div>
      <div class="aui-stats__value${t.tone ? ` ${t.tone}` : ''}">${escHtml(t.value)}</div>
      ${t.subHtml ? `<div class="alg-stats__sub">${t.subHtml}</div>` : t.sub ? `<div class="alg-stats__sub">${escHtml(t.sub)}</div>` : ''}
    </div>`).join('')}</div>`;
}

function feeCell(paid, quota) {
  if (!quota) return '<span class="aui-muted">—</span>';
  const pct = Math.round((paid / quota) * 100);
  return `<span class="alg-fee${pct >= 100 ? ' is-done' : ''}">${progress(pct, { label: `${Math.min(pct, 100)}%` })}</span>`;
}

// ── To confirm: pending entries, oldest first, confirmed or voided in place ───────────────
function confirmQueue(pending, colorById, { showName = true, season = '' } = {}) {
  if (!pending.length) return '<div class="aui-panel alg-clear">✓ Nothing waiting. Every payment is confirmed.</div>';
  return `<div class="alg-queue">${pending.map(tx => {
    const name = displayPlayerName(tx.player_name || '');
    const cat = canonCategory(tx.category);
    const what = [tx.type === 'charge' ? 'Charge' : methodLabel(tx.payment_method) || 'Payment', fmtDate(tx.date), tx.reference_no ? `Ref ${tx.reference_no}` : ''].filter(Boolean).join(' · ');
    const opts = [['', 'No category'], ...PAYMENT_CATEGORIES.map(c => [c, c])];
    return `<form class="alg-q" data-json-action="/admin/ledger/transaction/${attr(tx.id)}/confirm" data-done="${attr(`Confirmed ${name}’s ${peso(tx.amount)}.`)}">
      ${showName ? avatar(name, colorById[tx.player_id] || '', { size: 34, playerId: tx.player_id }) : ''}
      <span class="alg-q__who">${showName ? `<a class="alg-q__name" href="/admin/ledger?season=${encodeURIComponent(seasonParam(season))}&player=${encodeURIComponent(tx.player_id)}">${escHtml(name)}</a>` : ''}<span class="alg-q__sub">${escHtml(what)}</span></span>
      <span class="alg-q__meta">
        <select class="aui-input alg-q__cat" name="category" aria-label="Category for ${attr(name)}’s ${attr(peso(tx.amount))}">${opts.map(([v, l]) => `<option value="${attr(v)}"${v === cat ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select>
        <span class="alg-q__shot">${shotLink(tx)}</span>
      </span>
      <b class="alg-q__amt">${peso(tx.amount)}</b>
      <span class="alg-q__actions">
        <button type="submit" class="aui-btn aui-btn--primary aui-btn--sm alg-q__go">Confirm</button>
        ${button('Void', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/ledger/transaction/${attr(tx.id)}/void" data-done="Voided." data-confirm data-confirm-title="${attr(`Void ${name}’s ${peso(tx.amount)}?`)}" data-confirm-body="It stays in the history but never counts toward the balance." data-confirm-send="Void"` })}
      </span>
    </form>`;
  }).join('')}</div>`;
}

// ⋯ menu for one transaction (drawer list and the full history grid).
function txMenu(tx) {
  const amt = peso(tx.amount);
  return [
    tx.status === 'pending' ? { label: 'Confirm', post: `/admin/ledger/transaction/${tx.id}/confirm`, body: { category: canonCategory(tx.category) || tx.category || '' }, done: `Confirmed ${amt}.` } : null,
    tx.status !== 'voided' ? { label: 'Void', post: `/admin/ledger/transaction/${tx.id}/void`, done: 'Voided.', confirm: { title: `Void this ${amt} ${tx.type}?`, body: 'It stays in the history but never counts toward the balance.', send: 'Void' } } : null,
    'sep',
    { label: 'Delete', post: `/admin/ledger/transaction/${tx.id}`, method: 'DELETE', danger: true, done: 'Deleted.', confirm: { title: `Delete this ${amt} ${tx.type}?`, body: 'It disappears from the history for good. Void keeps a record instead.', send: 'Delete' } },
  ];
}

const txTitle = tx => canonCategory(tx.category) || tx.category || tx.notes || (tx.type === 'charge' ? 'Charge' : 'Payment');
const txAmount = tx => `<b class="alg-amt ${tx.status === 'voided' ? 'is-void' : tx.type === 'charge' ? 'aui-neg' : 'aui-pos'}">${tx.type === 'charge' ? '−' : '+'}${peso(tx.amount)}</b>`;
const STATUS = { pending: ['Pending', 'amber'], voided: ['Voided', 'gray'], confirmed: ['Confirmed', 'green'] };

// ── The charge / payment drawer (list page: many players; player page: one) ──────────────
function chargeDrawer({ id, action, seasons, season, players = null, playerId = '', playerName = '' }) {
  const today = new Date().toISOString().slice(0, 10);
  const seasonOpts = [...new Set([season, ...seasons].filter(Boolean).map(String))].map(s => [s, `Season ${s}`]);
  const who = players
    ? `<fieldset class="alg-fs" data-alg-picked-fs disabled hidden><div class="aui-field is-wide"><span class="aui-field__label">Players</span><div class="alg-picked" data-alg-picked></div></div></fieldset>
       <fieldset class="alg-fs" data-alg-picker-fs>${playerPicker({ name: 'player_ids[]', label: 'Players', options: players, placeholder: 'Type a name' })}</fieldset>`
    : `<input type="hidden" name="player_id" value="${attr(playerId)}">`;
  const form = `<form id="${attr(id)}-form" class="alg-form" data-alg-txform data-json-action="${attr(action)}" data-done="Saved.">
    ${who}
    ${segmented({ name: 'type', value: 'charge', label: 'Type', options: [['charge', 'Charge'], ['payment', 'Payment']] })}
    ${fieldGrid(`
      ${field({ label: 'Amount', name: 'amount', type: 'money', required: true, placeholder: '0', attrs: 'data-alg-amount' })}
      ${field({ label: 'Category', name: 'category', type: 'select', options: [['', 'No category'], ...PAYMENT_CATEGORIES.map(c => [c, c])], attrs: 'data-alg-category' })}
      ${field({ label: 'Status', name: 'status', type: 'select', value: 'confirmed', options: [['confirmed', 'Confirmed'], ['pending', 'Pending']], attrs: 'data-alg-status' })}
      ${field({ label: 'Date', name: 'date', type: 'date', value: today, required: true })}
      ${field({ label: 'Method', name: 'payment_method', type: 'select', value: 'gcash', options: METHODS })}
      ${field({ label: 'Season', name: 'season', type: 'select', value: season || seasonOpts[0]?.[0] || '', options: seasonOpts.length ? seasonOpts : [['', 'None']] })}
      ${field({ label: 'Reference no.', name: 'reference_no', placeholder: 'Optional' })}
      ${field({ label: 'Notes', name: 'notes', wide: true, placeholder: 'Shown to the player' })}`)}
    <p class="alg-note" data-alg-note></p>
  </form>`;
  return drawer({
    id, eyebrow: players ? 'Ledger' : playerName, title: 'Add a charge',
    bodyHtml: form,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}<button type="submit" form="${attr(id)}-form" class="aui-btn aui-btn--primary" data-alg-go>Save</button>`,
  });
}

// ── /admin/ledger ─────────────────────────────────────────────────────────────────────────
export function adminLedgerBody({
  players = [], allPlayers = [], balMap = {}, lastActivityMap = {}, seasons = [], season = '', quota = 0,
  feePaidByPlayer = {}, pending = [], latestRefByPlayer = {}, collected = 0, colorById = {}, query = {}, open = null,
  standingById = {}, remindedById = {}, overdueDays = 90, bannedIds = new Set(),
} = {}) {
  const sp = seasonParam(season);
  const rows = players.map(p => {
    const b = balMap[p.id] || {};
    return {
      id: p.id, name: displayPlayerName(p.name), team: p.team_name || '', color: colorById[p.id] || p.team_color || '',
      bal: Number(b.balance) || 0, pending: Number(b.pending_count) || 0, ref: latestRefByPlayer[p.id] || '',
      fee: Number(feePaidByPlayer[p.id]) || 0, last: lastActivityMap[p.id] || '',
      quiet: standingById[p.id]?.quietDays || 0, overdue: !!standingById[p.id]?.overdue, reminded: remindedById[p.id]?.at || 0,
      deadlinePassed: !!standingById[p.id]?.deadlinePassed, banned: bannedIds.has(p.id),
    };
  });

  // Owed and credit are totalled separately, over every balance on the books (all time).
  const allBal = Object.values(balMap).map(b => Number(b.balance) || 0);
  const owed = allBal.filter(b => b > EPS), credit = allBal.filter(b => b < -EPS);
  const sum = a => a.reduce((t, n) => t + n, 0);
  const stats = tiles([
    { label: 'Owed to the league', value: peso(sum(owed)), tone: 'aui-tone--red', sub: `${plural(owed.length, 'player')} · all time` },
    { label: 'Players in credit', value: peso(sum(credit)), tone: 'aui-tone--green', sub: `${plural(credit.length, 'player')} · all time` },
    { label: season ? `Collected, Season ${season}` : 'Collected, all time', value: peso(collected), ...(season && !quota ? { subHtml: 'No season fee set · <a class="aui-link" href="/admin/season">Set the season fee</a>' } : { sub: season ? `Season fee ${peso(quota)} each` : 'Confirmed payments' }) },
    { label: 'To confirm', value: String(pending.length), tone: pending.length ? 'aui-tone--amber' : '', sub: pending.length === 1 ? 'payment waiting' : 'payments waiting' },
  ]);

  const teams = [...new Set(rows.map(r => r.team).filter(Boolean))].sort();
  const openHref = r => `/admin/ledger?season=${encodeURIComponent(sp)}&player=${encodeURIComponent(r.id)}`;
  const columns = [
    { key: 'player', label: 'Player', primary: true, sort: r => r.name.toLowerCase(),
      cell: r => `${avatar(r.name, r.color, { size: 32, playerId: r.id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}${r.banned ? ` ${badge('Banned', 'red')}` : r.deadlinePassed ? ` ${badge('Deadline passed', 'amber')}` : ''}</span><span class="aui-cell__sub">${escHtml(r.team || 'No team')}</span></span>` },
    // Owing players who haven't paid or reached out in overdueDays get the "No word" line:
    // their reminder carries the suspension warning (lib/balance-reminders.js).
    { key: 'balance', label: 'Balance', num: true, sort: r => r.bal,
      cell: r => `<span class="aui-cell__stack"><span class="${balanceTone(r.bal)}">${escHtml(balanceText(r.bal))}</span>${r.overdue ? `<span class="aui-cell__sub aui-tone--red">No word in ${r.quiet} days</span>` : ''}</span>` },
    season ? { key: 'fee', label: `Season ${season} fee`, phone: false, sort: r => r.fee, cell: r => feeCell(r.fee, quota) } : null,
    { key: 'pending', label: 'Pending', bare: true, sort: r => r.pending,
      cell: r => (r.pending ? `<span class="aui-cell__stack alg-pend">${badge(`${r.pending} to confirm`, 'amber')}${r.ref ? `<span class="aui-cell__sub">Ref ${escHtml(r.ref)}</span>` : ''}</span>` : '<span class="aui-muted alg-desk">—</span>') },
    { key: 'last', label: 'Last activity', phone: false, sort: r => r.last, cell: r => (r.last ? escHtml(fmtDate(r.last)) : '<span class="aui-muted">—</span>') },
    { key: 'reminded', label: 'Reminded', phone: false, sort: r => r.reminded, cell: r => (r.reminded ? escHtml(fmtStamp(r.reminded)) : '<span class="aui-muted">—</span>') },
  ].filter(Boolean);

  const grid = dataGrid({
    id: 'alg-balances', baseUrl: '/admin/ledger', query, keep: { season: sp },
    rows, rowKey: r => r.id, noun: ['player', 'players'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'owes', label: 'Owes', test: r => r.bal > EPS },
      { key: 'overdue', label: `No word ${overdueDays}+ days`, test: r => r.overdue },
      // Warned, deadline gone, still no payment: an admin decides on the ban (drawer).
      { key: 'deadline', label: 'Deadline passed', test: r => r.deadlinePassed && !r.banned },
      { key: 'banned', label: 'Banned', test: r => r.banned },
      { key: 'pending', label: 'Pending', test: r => r.pending > 0 },
      { key: 'credit', label: 'In credit', test: r => r.bal < -EPS },
      { key: 'settled', label: 'Settled', test: r => Math.abs(r.bal) <= EPS },
    ],
    search: { placeholder: 'Search players', text: r => `${r.name} ${r.team}` },
    filters: teams.length ? [{ key: 'team', label: 'Team', options: [...teams.map(t => [t, t]), ['none', 'No team']], test: (r, v) => (v === 'none' ? !r.team : r.team === v) }] : [],
    defaultSort: '-balance', perPage: 50,
    columns,
    rowHref: openHref,
    bulk: [
      { label: 'Charge or record payment', eachUrl: '#alg-charge' },
      { label: 'Email balance reminder', eachUrl: '/admin/ledger/{id}/remind', done: 'Sent {n} reminder{s}.',
        confirm: { title: 'Email {n} player{s} a balance reminder?', body: `Each gets their balance, a settle link and a bell. Anyone with no word in ${overdueDays}+ days also gets a warning that their account will be suspended in 7 days. Anyone who doesn’t owe is skipped.` } },
    ],
    footer: list => {
      const o = list.filter(r => r.bal > EPS), c = list.filter(r => r.bal < -EPS);
      return `<tr><td colspan="${columns.length + 1}">${plural(list.length, 'player')} · ${peso(sum(o.map(r => r.bal)))} owed · ${peso(sum(c.map(r => r.bal)))} in credit</td></tr>`;
    },
    actionsHtml: button('+ Charge or payment', { kind: 'primary', attrs: 'data-alg-charge' }),
    empty: { title: 'No players on the ledger', sub: 'Players show here once they’re confirmed for the season or have a charge or payment.' },
  });

  // Copy summary: everyone who owes or is in credit, most owed first.
  const owing = rows.filter(r => Math.abs(r.bal) > EPS).sort((a, b) => b.bal - a.bal);
  const summaryText = [
    `WKND ledger · ${seasonLabel(season)}`,
    `Owed to the league: ${peso(sum(owed))} (${plural(owed.length, 'player')})`,
    `In credit: ${peso(sum(credit))} (${plural(credit.length, 'player')})`,
    `Collected${season ? `, Season ${season}` : ''}: ${peso(collected)}`,
    '',
    ...owing.map(r => `${r.name} — ${balanceText(r.bal)}`),
  ].join('\n');

  const pickerPlayers = allPlayers
    .map(p => ({ id: p.id, name: displayPlayerName(p.name), color: colorById[p.id] || p.team_color || '', meta: p.team_name || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return outlineDarkRings(`<div class="aui-page alg" data-alg-page>
    ${pageHeader({
      eyebrow: 'Finance', title: 'Ledger',
      sub: 'Every player’s balance. Balances are all-time; the season pick changes the fee progress and what’s collected.',
      actionsHtml: `${seasonSwitch(s => `/admin/ledger?season=${encodeURIComponent(s)}`, seasons, season)}${button('Copy summary', { kind: 'secondary', attrs: `data-alg-copy="${attr(summaryText)}"` })}`,
    })}
    ${stats}
    ${section({ title: 'To confirm', note: '· payments players sent in, oldest first', bodyHtml: confirmQueue(pending, colorById, { season }) })}
    ${section({ title: 'Balances', bodyHtml: grid })}
    ${open ? playerDrawer(open, { season, quota, colorById, remindedAt: remindedById[open.player.id]?.at || 0 }) : ''}
    ${chargeDrawer({ id: 'alg-charge', action: '/admin/ledger/bulk-charge', seasons, season, players: pickerPlayers })}
  </div>
  <script src="/admin-ledger.js" defer></script>`);
}

// The player drawer on /admin/ledger (?player=<id>); server-rendered open, so every action
// inside it re-renders it with fresh numbers.
function playerDrawer({ player, fin, transactions, seasonPaid, feePaid, standing = null }, { season, quota, colorById, remindedAt = 0 }) {
  const name = displayPlayerName(player.name);
  const bal = Number(fin?.current_balance) || 0;
  const t = [
    { label: 'Balance', value: balanceText(bal), tone: balanceTone(bal) === 'aui-muted' ? '' : balanceTone(bal) },
    { label: season ? `Paid, Season ${season}` : 'Paid, all time', value: peso(season ? seasonPaid : fin?.total_paid) },
    season && quota
      ? { label: 'Season fee', value: `${Math.min(100, Math.round((feePaid / quota) * 100))}%`, sub: `${peso(feePaid)} of ${peso(quota)}` }
      : { label: 'Charged, all time', value: peso(fin?.total_outstanding) },
  ];
  const recent = transactions.slice(0, 8);
  const list = recent.length
    ? `<div class="alg-txs">${recent.map(tx => {
        const sub = [tx.type === 'charge' ? 'Charge' : 'Payment', fmtDate(tx.date), tx.season ? `S${tx.season}` : '', tx.reference_no ? `Ref ${tx.reference_no}` : ''].filter(Boolean).join(' · ');
        return `<div class="alg-tx${tx.status === 'voided' ? ' is-void' : ''}">
          <span class="alg-tx__what"><span class="alg-tx__title">${escHtml(txTitle(tx))}</span><span class="alg-tx__sub">${escHtml(sub)}</span></span>
          ${tx.status !== 'confirmed' ? badge(...STATUS[tx.status] || STATUS.pending) : ''}
          ${txAmount(tx)}
          ${menu(txMenu(tx), 'Transaction actions')}
        </div>`;
      }).join('')}</div>`
    : '<p class="aui-muted alg-none">No charges or payments yet.</p>';
  // Balance reminder (POST /admin/ledger/:id/remind), only while they owe.
  const remind = standing?.owes ? `<div class="alg-remind">
      <span class="aui-cell__stack"><span class="aui-cell__title">Balance reminder</span><span class="aui-cell__sub${standing.overdue ? ' aui-tone--red' : ''}">${escHtml([
        standing.overdue ? `No word in ${standing.quietDays} days: includes the suspension warning` : 'Email + bell with their balance and a settle link',
        remindedAt ? `last sent ${fmtStamp(remindedAt)}` : '',
      ].filter(Boolean).join(' · '))}</span></span>
      ${button(remindedAt ? 'Send again' : 'Send reminder', { kind: 'secondary', size: 'sm', attrs: `data-post-json="/admin/ledger/${attr(encodeURIComponent(player.id))}/remind" data-done="Reminder sent." data-confirm data-confirm-title="Email ${attr(name)} a balance reminder?" data-confirm-body="${attr(standing.overdue ? `They owe ${peso(standing.balance)} and it’s been ${standing.quietDays} days, so it includes a warning that their account will be suspended in 7 days if they don’t settle or reach out.` : `They owe ${peso(standing.balance)}.`)}" data-confirm-send="Send"` })}
    </div>` : '';
  // Ban (POST /admin/players/:id/ban): BANNED on their profile, no Papawis or season sign-ups.
  const fmtDay = ymd => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const banUrl = `/admin/players/${attr(encodeURIComponent(player.id))}/ban`;
  const ban = player.banned_at
    ? `<div class="alg-remind">
        <span class="aui-cell__stack"><span class="aui-cell__title">${badge('Banned', 'red')} since ${escHtml(fmtStamp(player.banned_at))}</span><span class="aui-cell__sub">${escHtml(player.ban_reason || 'No reason noted')}${player.ban_kind === 'other' ? '' : ' · lifts on its own once settled'}</span></span>
        ${button('Lift ban', { kind: 'secondary', size: 'sm', attrs: `data-post-json="${banUrl}" data-body="${attr(JSON.stringify({ on: false }))}" data-done="Ban lifted." data-confirm data-confirm-title="Lift ${attr(name)}’s ban?" data-confirm-body="BANNED comes off their profile and they can sign up again." data-confirm-send="Lift ban"` })}
      </div>`
    : (standing?.owes || standing?.deadlinePassed) ? `<form class="alg-remind" data-json-action="${banUrl}" data-done="${attr(name)} banned." data-confirm data-confirm-title="Ban ${attr(name)}?" data-confirm-body="BANNED shows on their profile and player card, and they can’t join Papawis runs or sign up for a season until you lift it." data-confirm-send="Ban">
        <input type="hidden" name="on" value="1">
        <span class="aui-cell__stack"><span class="aui-cell__title">Ban <span class="aui-muted">· lifts on its own once settled</span></span><span class="aui-cell__sub${standing?.deadlinePassed ? ' aui-tone--red' : ''}">${escHtml(standing?.deadlinePassed ? `Warning deadline passed ${fmtDay(standing.deadline)}, no payment since` : standing?.warnedAt ? `Warned, deadline ${fmtDay(standing.deadline)}` : 'Not warned yet')}</span></span>
        <input class="aui-input" name="reason" value="Unpaid balance" aria-label="Reason (admin only)" style="width:150px">
        <input type="hidden" name="auto_lift" value="1">
        ${button('Ban…', { kind: 'danger', size: 'sm', type: 'submit' })}
      </form>` : '';
  const more = transactions.length > recent.length ? `<p class="aui-muted alg-none">${plural(transactions.length - recent.length, 'older entry', 'older entries')} in the full history.</p>` : '';
  const html = drawer({
    id: 'alg-player', eyebrow: `${player.team_name || 'No team'} · Ledger`, title: name,
    bodyHtml: `<div class="alg-player" data-alg-player="${attr(player.id)}">${tiles(t, 'alg-stats--3')}${remind}${ban}${list}${more}</div>`,
    footerHtml: `<a class="aui-link alg-history" href="/admin/ledger/${encodeURIComponent(player.id)}?season=${encodeURIComponent(seasonParam(season))}">Open full history</a>
      ${button('+ Add transaction', { kind: 'primary', attrs: `data-alg-add="${attr(player.id)}" data-alg-add-name="${attr(name)}"` })}`,
  });
  // Rendered open: this drawer only exists when ?player= asks for it.
  return html.replace(' hidden data-drawer', ' data-drawer data-alg-open');
}

// ── /admin/ledger/:id ─────────────────────────────────────────────────────────────────────
export function adminLedgerPlayerBody({ player, fin = {}, transactions = [], seasons = [], season = '', quota = 0, feePaid = 0, pending = [], colorById = {}, query = {} } = {}) {
  const name = displayPlayerName(player.name);
  const sp = seasonParam(season);
  const bal = Number(fin.current_balance) || 0;
  // Season tiles count only that season's rows (unseasoned ones are all-time only), like the drawer.
  const confirmed = transactions.filter(t => t.status === 'confirmed' && (!season || String(t.season ?? '') === String(season)));
  const paid = confirmed.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  const charged = confirmed.filter(t => t.type === 'charge').reduce((s, t) => s + t.amount, 0);

  const stats = tiles([
    { label: 'Balance, all time', value: balanceText(bal), tone: balanceTone(bal) === 'aui-muted' ? '' : balanceTone(bal) },
    { label: season ? `Paid, Season ${season}` : 'Paid, all time', value: peso(season ? paid : fin.total_paid) },
    season && quota
      ? { label: `Season ${season} fee`, value: `${Math.min(100, Math.round((feePaid / quota) * 100))}%`, sub: `${peso(feePaid)} of ${peso(quota)}` }
      : { label: season ? `Charged, Season ${season}` : 'Charged, all time', value: peso(season ? charged : fin.total_outstanding) },
  ], 'alg-stats--3');

  const rowsWithKey = transactions.map((t, i) => ({ ...t, _i: i }));
  const grid = dataGrid({
    id: 'alg-history', baseUrl: `/admin/ledger/${encodeURIComponent(player.id)}`, query, keep: { season: sp },
    rows: rowsWithKey, rowKey: t => t.id, noun: ['entry', 'entries'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'pending', label: 'Pending', test: t => t.status === 'pending' },
      { key: 'confirmed', label: 'Confirmed', test: t => t.status === 'confirmed' },
      { key: 'voided', label: 'Voided', test: t => t.status === 'voided' },
    ],
    search: { placeholder: 'Search notes, category, ref', text: t => `${t.category} ${t.notes} ${t.reference_no}` },
    filters: [{ key: 'type', label: 'Type', options: [['charge', 'Charges'], ['payment', 'Payments']], test: (t, v) => t.type === v }],
    defaultSort: '-date', perPage: 50,
    columns: [
      { key: 'date', label: 'Date', nowrap: true, bare: true, sort: t => `${t.date}|${String(1e6 - t._i).padStart(7, '0')}`, cell: t => escHtml(fmtDate(t.date)) },
      { key: 'what', label: 'What', primary: true, sort: t => txTitle(t).toLowerCase(),
        cell: t => {
          const sub = [t.type === 'charge' ? 'Charge' : 'Payment', t.category && t.notes ? t.notes : '', t.reference_no ? `Ref ${t.reference_no}` : ''].filter(Boolean).join(' · ');
          return `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(txTitle(t))}</span><span class="aui-cell__sub">${escHtml(sub)}${isSafeScreenshot(t.screenshot_url) ? ` · ${shotLink(t)}` : ''}</span></span>`;
        } },
      { key: 'amount', label: 'Amount', num: true, bare: true, sort: t => (t.type === 'charge' ? -1 : 1) * t.amount, cell: txAmount },
      // Badge only the states that need a look (like the drawer); confirmed is the norm.
      { key: 'status', label: 'Status', bare: true, sort: t => t.status, cell: t => (t.status === 'confirmed' ? '<span class="aui-muted alg-desk">Confirmed</span>' : badge(...(STATUS[t.status] || STATUS.pending))) },
      { key: 'season', label: 'Season', phone: false, sort: t => Number(t.season) || 0, cell: t => (t.season ? escHtml(`S${t.season}`) : '<span class="aui-muted">—</span>') },
      { key: 'method', label: 'Method', phone: false, cell: t => (t.payment_method ? escHtml(methodLabel(t.payment_method)) : '<span class="aui-muted">—</span>') },
    ],
    rowMenu: txMenu,
    footer: list => {
      const c = list.filter(t => t.status === 'confirmed');
      const ch = c.filter(t => t.type === 'charge').reduce((s, t) => s + t.amount, 0);
      const pd = c.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
      return `<tr><td colspan="7">${plural(list.length, 'entry', 'entries')} · charged ${peso(ch)} · paid ${peso(pd)}</td></tr>`;
    },
    empty: { title: 'No charges or payments yet', sub: season ? `Nothing in Season ${season}. Try All time.` : 'Add one with “+ Add transaction”.' },
  });

  return outlineDarkRings(`<div class="aui-page alg" data-alg-page>
    ${breadcrumb([{ label: 'Ledger', href: `/admin/ledger?season=${encodeURIComponent(sp)}` }, { label: name }])}
    ${personStrip({ name, color: colorById[player.id] || '', playerId: player.id, sub: player.team_name || 'No team', links: [{ label: 'Ledger', href: `/admin/ledger/${encodeURIComponent(player.id)}`, active: true }, { label: 'Player', href: `/admin/players/${encodeURIComponent(player.id)}` }] })}
    <div class="aui-row-between">
      ${seasonSwitch(s => `/admin/ledger/${encodeURIComponent(player.id)}?season=${encodeURIComponent(s)}`, seasons, season)}
      ${button('+ Add transaction', { kind: 'primary', attrs: 'data-alg-add-one' })}
    </div>
    ${stats}
    ${pending.length ? section({ title: 'To confirm', note: '· all seasons, oldest first', bodyHtml: confirmQueue(pending, colorById, { showName: false }) }) : ''}
    ${section({ title: 'History', note: `· ${seasonLabel(season)}`, bodyHtml: grid })}
    ${chargeDrawer({ id: 'alg-add', action: '/admin/ledger/transaction', seasons, season, playerId: player.id, playerName: name })}
  </div>
  <script src="/admin-ledger.js" defer></script>`);
}
