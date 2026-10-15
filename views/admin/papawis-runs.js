// /admin/papawis: every Papawis run (admin redesign, 2026-10-15; mockup: canvas "Papawis ·
// Runs list"). Rebuilt from scratch on views/admin/ui.js. Runs on the shared data grid,
// money owed from every run in one list, the Papawis switches, and New run in a drawer.
import { escHtml } from '../layout.js';
import { displayPlayerName, isPapawisSignupOpenNow } from '../utils.js';
import { pageHeader, dataGrid, statStrip, section, badge, button, drawer, field, fieldGrid, toggleRow, emptyState, avatar } from './ui.js';
import { paidCell } from './papawis-run.js';

const attr = s => escHtml(String(s ?? ''));
const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const fmtDate = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const fmtDow = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }) : '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function statusBadges(g, today) {
  const out = [];
  if (g.status === 'cancelled') out.push(badge('Cancelled', 'red'));
  else if (g.status === 'completed') out.push(badge('Completed', 'gray'));
  else {
    if (g.date < today) out.push(badge('Needs close-out', 'amber'));
    else if (!isPapawisSignupOpenNow(g)) out.push(badge('Scheduled', 'blue'));
    else if ((g.confirmed_count || 0) >= g.max_slots) out.push(badge('Full', 'amber'));
    else out.push(badge('Open', 'green'));
    if (g.signups_locked_at) out.push(badge('Locked', 'gray'));
    if (g.date >= today && !g.announced_at && !g.signups_locked_at && !(g.announce_send_at && !g.announced_at)) out.push(badge('Not announced', 'amber'));
  }
  return `<span class="aui-cell__badges">${out.join('')}</span>`;
}

function slotsCell(g) {
  const n = g.confirmed_count || 0, max = g.max_slots || 0;
  const pct = max ? Math.min(100, Math.round((n / max) * 100)) : 0;
  return `<span class="pw-slots"><span class="pw-slots__track"><span class="pw-slots__fill" style="width:${Math.max(pct, 2)}%"></span></span><span class="aui-num">${n}<span class="aui-muted">/${max}</span></span>${g.waitlist_count ? badge(`+${g.waitlist_count} waiting`, 'blue') : ''}</span>`;
}

// Everything owed across runs: unpaid charges on completed runs and submitted payments
// waiting for a confirm. Oldest first. Kept as a plain table (not a second grid) so the
// runs grid owns the page's ?view/sort params.
function moneyToChase(unpaidSignups, pendingPayments, unlinkedByPlayer, reusableByPlayer, colorById) {
  const rows = [
    ...unpaidSignups.map(s => ({ date: s.game_date, kind: 'unpaid', s })),
    ...pendingPayments.map(t => ({ date: t.date, kind: 'pending', t })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!rows.length) return emptyState({ title: 'Nobody owes anything', sub: 'Unpaid charges and payments to confirm show up here.' });
  const unpaidTotal = unpaidSignups.reduce((t, s) => t + (Number(s.price_per_player) || 0), 0);
  const tr = r => {
    if (r.kind === 'unpaid') {
      const s = r.s;
      const name = displayPlayerName(s.player_name);
      const cands = (unlinkedByPlayer[s.player_id] || []).filter(c => c.date >= s.game_date);
      const reuse = (reusableByPlayer[s.player_id] || []).filter(c => c.date >= s.game_date);
      return `<tr class="aui-grid__row">
        <td class="is-primary" data-label="Player"><span class="aui-who">${avatar(name, colorById[s.player_id] || '', { playerId: s.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}</span>${s.guest_name ? `<span class="aui-cell__sub">for guest ${escHtml(s.guest_name)}</span>` : ''}</span></span></td>
        <td class="is-bare" data-label="Run"><a class="aui-link" href="/admin/papawis/${attr(s.game_id)}?tab=money">${escHtml(s.game_title || 'Papawis')}</a></td>
        <td class="is-num is-bare" data-label="Amount">${peso(s.price_per_player)}</td>
        <td class="is-bare" data-label="Status">${paidCell({ id: s.game_id }, s, cands, reuse, { unpaidBadge: false })}</td>
      </tr>`;
    }
    const t = r.t;
    const name = displayPlayerName(t.player_name || '');
    const what = /deposit/i.test(t.category || '') ? 'Deposit' : 'Game payment';
    return `<tr class="aui-grid__row">
      <td class="is-primary" data-label="Player"><span class="aui-who">${avatar(name, colorById[t.player_id] || '', { playerId: t.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}</span><span class="aui-cell__sub">${escHtml(what)}${t.reference_no ? ` · ref ${escHtml(t.reference_no)}` : ''}</span></span></span></td>
      <td data-label="Run"><span class="aui-muted">${escHtml(fmtDate(t.date))}</span></td>
      <td class="is-num" data-label="Amount">${peso(t.amount)}</td>
      <td class="is-bare" data-label="Status"><span class="pw-paid">${badge('To confirm', 'amber')}<span class="aui-row">
        ${button('Confirm', { kind: 'primary', size: 'sm', attrs: `data-post-json="/admin/ledger/transaction/${attr(t.id)}/confirm" data-done="Payment confirmed." data-confirm data-confirm-title="Confirm ${attr(name)}’s ${peso(t.amount)} payment?" data-confirm-send="Confirm"` })}
        ${button('Void', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/ledger/transaction/${attr(t.id)}/void" data-done="Payment voided." data-confirm data-confirm-title="Void this payment?" data-confirm-body="It stays in the history but is reversed." data-confirm-send="Void"` })}
      </span></span></td>
    </tr>`;
  };
  return `${unpaidSignups.length ? `<p class="aui-muted" style="margin:0">${plural(unpaidSignups.length, 'unpaid charge')} · ${peso(unpaidTotal)}${pendingPayments.length ? ` · ${plural(pendingPayments.length, 'payment')} to confirm` : ''}</p>` : ''}
    <div class="aui-grid__card"><div class="aui-grid__scroll"><table class="aui-grid__table">
      <thead><tr><th>Player</th><th>Run</th><th class="is-num">Amount</th><th>Status</th></tr></thead>
      <tbody>${rows.map(tr).join('')}</tbody>
    </table></div></div>`;
}

export function adminPapawisRunsBody({
  games = [], pendingPayments = [], unpaidSignups = [], unpaidUnlinkedByPlayer = {}, unpaidReusableByPlayer = {}, courts = [],
  papawisEnabled = false, remindersEnabled = false, slotAlertsEnabled = false, regularsCount = 0, today = '', query = {}, colorById = {},
}) {
  const upcoming = games.filter(g => g.status === 'open' && g.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const next = upcoming[0];
  const unpaidTotal = unpaidSignups.reduce((t, s) => t + (Number(s.price_per_player) || 0), 0);
  const stats = statStrip([
    { label: next ? `Next run · ${fmtDow(next.date)} ${fmtDate(next.date)}` : 'Next run', value: next ? String(next.confirmed_count || 0) : '—', of: next ? `/${next.max_slots}` : '' },
    { label: 'Unpaid from past runs', value: peso(unpaidTotal) },
    { label: 'Payments to confirm', value: String(pendingPayments.length) },
    { label: 'Regulars', value: String(regularsCount) },
  ]);

  const grid = dataGrid({
    id: 'runs', baseUrl: '/admin/papawis', query,
    rows: games, rowKey: g => g.id, noun: ['run', 'runs'],
    views: [
      { key: 'upcoming', label: 'Upcoming', test: g => g.status === 'open' && g.date >= today },
      { key: 'closeout', label: 'To close out', test: g => g.status === 'open' && g.date < today },
      { key: 'past', label: 'Completed', test: g => g.status === 'completed' },
      { key: 'cancelled', label: 'Cancelled', test: g => g.status === 'cancelled' },
      { key: 'all', label: 'All', test: () => true },
    ],
    search: { placeholder: 'Search title or court', text: g => `${g.title} ${g.location}` },
    filters: courts.length > 1 ? [{ key: 'court', label: 'Court', options: courts.map(c => [c.name, c.name]), test: (g, v) => g.location === v }] : [],
    // Upcoming reads soonest first; past views newest first.
    defaultSort: !query.view || query.view === 'upcoming' ? 'date' : '-date', perPage: 25,
    columns: [
      { key: 'date', label: 'Date', num: true, bare: true, sort: g => g.date, cell: g => `${escHtml(fmtDate(g.date))}<div class="aui-cell__sub" style="font-family:Archivo,sans-serif">${escHtml(fmtDow(g.date))}</div>` },
      { key: 'title', label: 'Run', primary: true, sort: g => String(g.title || '').toLowerCase(), cell: g => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(g.title || 'Papawis')}</span><span class="aui-cell__sub">${escHtml(g.location || 'No court set')}</span></span>` },
      { key: 'slots', label: 'Slots', bare: true, sort: g => g.confirmed_count || 0, cell: slotsCell },
      { key: 'price', label: 'Price', num: true, phone: false, sort: g => g.price_per_player || 0, cell: g => (g.price_per_player != null ? peso(g.price_per_player) : '<span class="aui-muted">—</span>') },
      { key: 'status', label: 'Status', bare: true, cell: g => statusBadges(g, today) },
    ],
    rowHref: g => `/admin/papawis/${g.id}`,
    rowMenu: g => [
      { label: 'Open run', href: `/admin/papawis/${g.id}` },
      g.status === 'open' ? { label: 'Messages', href: `/admin/papawis/${g.id}?tab=messages` } : null,
      { label: 'Money', href: `/admin/papawis/${g.id}?tab=money` },
      { label: 'View on site', href: `/papawis#pw-game-${g.id}`, external: true },
    ],
    actionsHtml: button('+ New run', { kind: 'primary', attrs: 'data-drawer-open="new-run"' }),
    empty: { title: 'No runs here', sub: 'Create one with “+ New run”.' },
  });

  const switches = `<div class="aui-panel">
    ${toggleRow({ label: 'Papawis on the site', help: 'Sign-ups on /papawis. Managing runs here works either way.', name: 'papawis_enabled', on: papawisEnabled, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Reminder and cancellation emails', help: 'The hourly reminder scan and cancellation notices only send when this is on.', name: 'papawis_reminders_enabled', on: remindersEnabled, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Slot-opened alerts', help: 'When a full run loses a player and nobody is waiting: email regulars, then 30 min later anyone who viewed the roster. Live site only.', name: 'papawis_slot_alerts_enabled', on: slotAlertsEnabled, post: '/admin/site/settings', setting: true })}
  </div>`;

  const newRun = drawer({
    id: 'new-run', eyebrow: 'Papawis', title: 'New run',
    bodyHtml: `<form id="new-run-form" data-json-action="/admin/papawis" data-then="/admin/papawis/{id}" data-done="Run created.">${fieldGrid(`
        ${field({ label: 'Date', name: 'date', type: 'date', required: true, attrs: 'data-auto-title-source' })}
        ${field({ label: 'Max players', name: 'max_slots', type: 'number', value: '20', attrs: 'min="1" step="1"' })}
        ${field({ label: 'Title', name: 'title', wide: true, placeholder: 'Filled from the date, e.g. Sunday (Oct 25)', attrs: 'data-auto-title' })}
        ${field({ label: 'Start', name: 'start_time', type: 'time' })}
        ${field({ label: 'End', name: 'end_time', type: 'time' })}
        ${field({ label: 'Court', name: 'location', type: 'select', wide: true, attrs: 'data-other-toggle', options: [['', 'Select a court…'], ...courts.map(c => [c.name, c.name]), ['__other__', 'Other…']] })}
        ${field({ label: 'Other location', name: 'location_other', wide: true, attrs: 'data-other-field hidden' })}`)}
      <label class="aui-check" style="margin-top:14px"><input type="checkbox" name="open_days_before" value="6"><span>Hold sign-ups until 6 days before (shows as Scheduled)</span></label>
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Create run', { kind: 'primary', type: 'submit', attrs: 'form="new-run-form"' })}`,
  });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Runs', sub: 'Pickup games. Open one to manage its roster, teams, money and messages.' })}
    ${stats}
    ${grid}
    ${section({ title: 'Money to chase', note: '· every run, oldest first', asideHtml: '<a class="aui-link" href="/admin/ledger">Open the ledger</a>', bodyHtml: moneyToChase(unpaidSignups, pendingPayments, unpaidUnlinkedByPlayer, unpaidReusableByPlayer, colorById) })}
    ${section({ title: 'Switches', bodyHtml: switches })}
    ${newRun}
  </div>
  <script src="/admin-papawis.js" defer></script>`;
}
