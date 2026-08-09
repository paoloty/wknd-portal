import { escHtml } from '../layout.js';
import { displayPlayerName, formatTimeRange, isPapawisSignupOpenNow } from '../utils.js';
import { CUTOFF_DAYS as PAPAWIS_CUTOFF_DAYS } from '../papawis.js';
import { parseHeightCm } from '../../lib/papawis-teams.js';

const PAPAWIS_LOCATIONS = [
  'Cloverleaf Basketball Court, Makati',
  'Gatorade Hoops Center, Mandaluyong',
  'Gameville Ball Park, Mandaluyong',
  'Dumlao Sports Center, Mandaluyong',
  'Reyes Gym Basketball Court, Mandaluyong',
  'Activate Hoop Arena, Pasig',
  'The Upper Deck Sports Center, Pasig',
  'G Court, Mandaluyong',
  'Meralco Basketball Gym, Pasig',
  'Philsports Arena Basketball Court, Pasig',
];

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_PLUS      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>`;
const ICON_CHECK     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_X         = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/></svg>`;
const ICON_TRASH     = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h10M5.5 3.5V2.5h3v1M12 3.5l-.9 8a1 1 0 0 1-1 .9H3.9a1 1 0 0 1-1-.9L2 3.5"/></svg>`;
const ICON_CHEVRON_UP   = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5l3.5-3.5 3.5 3.5"/></svg>`;
const ICON_CHEVRON_DOWN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg>`;

function fmtDate(d) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

function addDaysStr(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtLogTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ACTIVITY_LABELS = {
  registered:    { label: 'registered', color: 'text-amber-400' },
  joined:        { label: 'joined',    color: 'text-emerald-400' },
  cancelled:     { label: 'cancelled', color: 'text-red-400' },
  promoted:      { label: 'moved to confirmed', color: 'text-emerald-400' },
  waitlisted:    { label: 'moved to waitlist',  color: 'text-amber-400' },
  viewed_roster: { label: 'viewed the player list', color: 'text-slate-400' },
  reminded:      { label: 'reminder emailed', color: 'text-sky-400' },
  cancel_notified: { label: 'notified of cancellation', color: 'text-red-400' },
  completion_notified: { label: 'sent payment receipt', color: 'text-sky-400' },
};

// Shared between the per-game log (Game column hidden) and the global feed (shown).
function activityRow(e, { showGame = false } = {}) {
  const cfg = ACTIVITY_LABELS[e.event_type] || { label: e.event_type, color: 'text-slate-400' };
  return `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-sm font-medium text-slate-100">${escHtml(e.player_name || 'Someone')}</td>
    <td class="px-4 py-2.5 text-sm ${cfg.color}">${escHtml(cfg.label)}${e.notes ? `<span class="text-xs text-slate-500"> (${escHtml(e.notes)})</span>` : ''}</td>
    ${showGame ? `<td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(e.game_title || 'General')}</td>` : ''}
    <td class="px-4 py-2.5 text-xs text-slate-500 text-right whitespace-nowrap">${fmtLogTime(e.created_at)}</td>
  </tr>`;
}

function activityTableHead(showGame) {
  return `<thead><tr>
    <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player</th>
    <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Action</th>
    ${showGame ? '<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Game</th>' : ''}
    <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">When</th>
  </tr></thead>`;
}

const signupOpenNow = isPapawisSignupOpenNow;

function papawisTeamLabel(team) {
  if (team === 'light') return 'Light';
  if (team === 'dark')  return 'Dark';
  return '—';
}

// Paid status — only meaningful for a confirmed signup on a *completed* game (waitlisted
// players were never charged, and there's nothing to mark on an open one). The "Paid"
// state doubles as an unmark button, so a mis-click is reversible without leaving the
// ledger out of sync — see the /admin/papawis/:id/signups/:signupId/paid route, which
// voids the exact transaction this created rather than guessing which one to reverse.
//
// candidates = getUnlinkedPapawisPayments(s.player_id), passed down from the route — a
// player who already paid through /settle-balance (or was entered directly in the ledger)
// shows up here instead of silently staying "Unpaid" forever. Exactly one candidate gets a
// one-click Link suggestion (adopts that existing transaction, creates nothing new);
// more than one is genuinely ambiguous, so that just points at the ledger instead of
// guessing which payment belongs to this game.
function paidStatusHtml(s, candidates = []) {
  if (s.status !== 'confirmed') return '<span class="text-slate-600">—</span>';
  if (s.paid_at) {
    return `<button type="button" class="agm-badge agm-badge--green" data-unmark-paid="${escHtml(s.id)}" style="border:none;cursor:pointer;font:inherit">Paid ✓</button>`;
  }
  const markPaidBtn = (label) => `<button type="button" class="admin-btn admin-btn--sm admin-btn--success" data-mark-paid="${escHtml(s.id)}">${label}</button>`;
  if (candidates.length === 1) {
    const c = candidates[0];
    return `<div class="flex flex-col gap-1 items-start">
      <span class="agm-badge agm-badge--amber">Unpaid</span>
      <div class="text-[11px] text-emerald-400 leading-snug">Possible match: ₱${Number(c.amount).toLocaleString()} paid ${escHtml(fmtDate(c.date))}</div>
      <div class="flex gap-1.5">
        <button type="button" class="admin-btn admin-btn--sm admin-btn--success" data-link-payment="${escHtml(s.id)}" data-tx-id="${escHtml(c.id)}">Link</button>
        ${markPaidBtn('Mark Paid instead')}
      </div>
    </div>`;
  }
  if (candidates.length > 1) {
    return `<div class="flex flex-col gap-1 items-start">
      <span class="agm-badge agm-badge--amber">Unpaid</span>
      <a href="/admin/ledger/${escHtml(s.player_id)}" target="_blank" class="text-[11px] text-amber-400 leading-snug">⚠ ${candidates.length} unconfirmed papawis payments — check ledger</a>
      ${markPaidBtn('Mark Paid')}
    </div>`;
  }
  return `<span class="agm-badge agm-badge--amber">Unpaid</span> <span style="margin-left:6px">${markPaidBtn('Mark Paid')}</span>`;
}

// Read-only stand-in for the interactive confirmed/waitlist board once a roster is
// locked — a plain table is simpler and less error-prone than trying to keep half the
// drag/move affordances alive on a list that shouldn't actually change anymore.
function lockedSummaryRow(s, { showPaid = false, unlinkedByPlayer = {} } = {}) {
  const rawName = s.guest_name ? s.guest_name : displayPlayerName(s.player_name);
  const name = escHtml(rawName);
  return `<tr class="border-b border-admin-border/50 last:border-b-0" data-status="${s.status}" data-name="${escHtml(rawName)}" data-paid="${s.paid_at ? '1' : '0'}">
    <td class="px-4 py-2.5 text-sm font-medium text-slate-200">${name}${s.guest_name ? ' <span class="text-xs text-slate-500">(guest)</span>' : ''}</td>
    <td class="px-4 py-2.5 text-xs">${s.status === 'confirmed' ? '<span class="agm-badge agm-badge--green">Confirmed</span>' : '<span class="agm-badge agm-badge--amber">Waitlist</span>'}</td>
    <td class="px-4 py-2.5 text-xs text-slate-400">${papawisTeamLabel(s.team)}</td>
    ${showPaid ? `<td class="px-4 py-2.5 text-xs">${paidStatusHtml(s, unlinkedByPlayer[s.player_id] || [])}</td>` : ''}
  </tr>`;
}

function statusBadge(game) {
  if (game.status === 'cancelled') return `<span class="agm-badge agm-badge--gray">Cancelled</span>`;
  if (game.status === 'completed') return `<span class="agm-badge agm-badge--blue">Completed</span>`;
  if (game.status === 'open' && !signupOpenNow(game)) return `<span class="agm-badge agm-badge--gray">Scheduled</span>`;
  if ((game.confirmed_count || 0) >= game.max_slots) return `<span class="agm-badge agm-badge--gray">Full</span>`;
  return `<span class="agm-badge agm-badge--amber">Open</span>`;
}

// ── List ──────────────────────────────────────────────────────────────────────
export function adminPapawisListBody({ games = [], papawisRemindersEnabled = false } = {}) {
  const rows = games.map(g => `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(g.date)}</td>
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(g.title || 'Papawis')}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${escHtml(g.location || '—')}</td>
      <td class="px-4 py-3 text-sm text-slate-300 font-saira">${g.confirmed_count || 0}<span class="text-slate-600">/${g.max_slots}</span>${g.waitlist_count ? `<span class="text-[11px] text-slate-500 ml-1">+${g.waitlist_count} waiting</span>` : ''}</td>
      <td class="px-4 py-3">${statusBadge(g)}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${g.price_per_player != null ? '₱' + Number(g.price_per_player).toLocaleString() : '—'}</td>
      <td class="px-4 py-3 text-right">
        <a href="/admin/papawis/${escHtml(g.id)}" class="agm-edit-link">Manage ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Papawis</h2>
  <div class="flex items-center gap-2">
    <a href="/admin/visibility" class="admin-btn">Visibility</a>
    <a href="/admin/papawis/activity" class="admin-btn">Activity Log</a>
    <button class="agm-new-btn" id="pw-new-btn">${ICON_PLUS} New Papawis</button>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg mb-5">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Notifications</div>
  <div class="p-5">
    <div class="flex items-center justify-between py-1">
      <div>
        <div class="text-[13px] font-semibold text-slate-200">Send reminder &amp; cancellation emails</div>
        <div class="text-xs text-slate-500 mt-0.5">Off by default — the hourly reminder scan and cancel-notice emails only fire once this is on.</div>
      </div>
      <label class="site-toggle" title="Toggle Papawis emails">
        <input type="checkbox" id="pw-toggle-reminders" ${papawisRemindersEnabled ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>
    <span id="pw-reminders-msg" class="text-xs block mt-1 min-h-[16px]"></span>
  </div>
</div>

<div class="agm-modal-backdrop" id="pw-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">New Papawis</h3>
      <button class="agm-modal-close" id="pw-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body">
      <div class="agm-modal-field">
        <label class="agm-modal-label">Title</label>
        <input type="text" id="pw-title" class="agm-modal-input" placeholder="e.g. Sunday (Aug 2)">
      </div>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Date</label>
          <input type="date" id="pw-date" class="agm-modal-input">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">Max slots</label>
          <input type="number" id="pw-max-slots" class="agm-modal-input" value="10" min="1" step="1">
        </div>
      </div>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Start time</label>
          <input type="time" id="pw-start-time" class="agm-modal-input">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">End time</label>
          <input type="time" id="pw-end-time" class="agm-modal-input">
        </div>
      </div>
      <div class="agm-modal-field">
        <label class="agm-modal-label">Location</label>
        <select id="pw-location-select" class="agm-modal-select">
          <option value="">Select location…</option>
          ${PAPAWIS_LOCATIONS.map(loc => `<option value="${escHtml(loc)}">${escHtml(loc)}</option>`).join('')}
          <option value="__other__">Others</option>
        </select>
      </div>
      <div class="agm-modal-field" id="pw-location-other-wrap" hidden>
        <label class="agm-modal-label">Other location</label>
        <input type="text" id="pw-location-other" class="agm-modal-input" placeholder="Enter location">
      </div>
      <label class="agm-modal-checkbox">
        <input type="checkbox" id="pw-delay-open">
        <span>Hold sign-ups until 6 days before the game (game still shows publicly, marked "Scheduled")</span>
      </label>
      <p class="agm-modal-err" id="pw-err" hidden></p>
    </div>
    <div class="agm-modal-footer">
      <button class="agm-new-btn agm-new-btn--ghost" id="pw-modal-cancel">${ICON_X} Cancel</button>
      <button class="agm-new-btn" id="pw-submit">${ICON_CHECK} Create Papawis</button>
    </div>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Date</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Title</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Location</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Slots</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Status</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Price</th>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">No papawis scheduled yet.</td></tr>'}
    </tbody>
  </table>
</div>

<script>
(function() {
  function bindToggle(id, key, msgId) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', async function() {
      var msg = document.getElementById(msgId);
      msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch(e) {
        msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
        this.checked = !this.checked;
      }
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  }
  bindToggle('pw-toggle-reminders', 'papawis_reminders_enabled', 'pw-reminders-msg');

  var backdrop = document.getElementById('pw-modal-backdrop');
  function openModal() { backdrop.hidden = false; document.getElementById('pw-title').focus(); }
  function closeModal() { backdrop.hidden = true; document.getElementById('pw-err').hidden = true; }
  document.getElementById('pw-new-btn').addEventListener('click', openModal);
  document.getElementById('pw-modal-close').addEventListener('click', closeModal);
  document.getElementById('pw-modal-cancel').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });

  // Title defaults to "Dayname (Date)" from the picked date, until the admin types their own.
  var titleInput = document.getElementById('pw-title');
  var titleTouched = false;
  titleInput.addEventListener('input', function() { titleTouched = true; });
  document.getElementById('pw-date').addEventListener('change', function() {
    if (titleTouched || !this.value) return;
    var d = new Date(this.value + 'T00:00:00');
    var day   = d.toLocaleDateString('en-US', { weekday: 'long' });
    var short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    titleInput.value = day + ' (' + short + ')';
  });

  var locationSelect = document.getElementById('pw-location-select');
  var locationOtherWrap = document.getElementById('pw-location-other-wrap');
  locationSelect.addEventListener('change', function() {
    locationOtherWrap.hidden = this.value !== '__other__';
  });

  document.getElementById('pw-submit').addEventListener('click', function() {
    var title     = titleInput.value.trim();
    var date      = document.getElementById('pw-date').value;
    var startTime = document.getElementById('pw-start-time').value;
    var endTime   = document.getElementById('pw-end-time').value;
    var location  = locationSelect.value === '__other__'
      ? document.getElementById('pw-location-other').value.trim()
      : locationSelect.value;
    var maxSlots  = document.getElementById('pw-max-slots').value;
    var delayOpen = document.getElementById('pw-delay-open').checked;
    var errEl = document.getElementById('pw-err');
    var btn = this;
    var orig = btn.innerHTML;
    if (!date) { errEl.textContent = 'Date is required.'; errEl.hidden = false; return; }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'Creating…';
    fetch('/admin/papawis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, date: date, start_time: startTime, end_time: endTime, location: location, max_slots: maxSlots, open_days_before: delayOpen ? 6 : null })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) { window.location.href = '/admin/papawis/' + data.id; }
      else { errEl.textContent = data.error || 'Failed to create.'; errEl.hidden = false; btn.disabled = false; btn.innerHTML = orig; }
    })
    .catch(function() { errEl.textContent = 'Network error.'; errEl.hidden = false; btn.disabled = false; btn.innerHTML = orig; });
  });
})();
</script>`;
}

// ── Detail / manage ───────────────────────────────────────────────────────────
// 20 slots has historically settled on a flat ₱270/player rate; smaller turnouts scale
// off a fixed ₱4,200 court budget instead, rounded to the nearest ₱10 so the number is
// still easy to collect in cash. Always just a starting point in the (editable) input —
// never charged as-is without the admin looking at it first.
export function defaultPapawisPrice(confirmedCount) {
  if (!confirmedCount) return null;
  if (confirmedCount === 20) return 270;
  return Math.round((4200 / confirmedCount) / 10) * 10;
}

export function adminPapawisDetailBody({ game, signups = [], players = [], activity = [], daysLeft = Infinity, unlinkedByPlayer = {} } = {}) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const waitlist  = signups.filter(s => s.status === 'waitlist');
  const isOpen      = game.status === 'open';
  const isCompleted = game.status === 'completed';
  const isCancelled = game.status === 'cancelled';
  const isScheduled = isOpen && !signupOpenNow(game);
  // Manual lock — set once an admin has actually sent the list out (e.g. "Copy for
  // Messenger"), independent of the automated reminder-email setting. While locked, the
  // whole roster/teams editing surface is swapped for a static summary table.
  const isLocked    = !!game.signups_locked_at;
  const defaultPrice = defaultPapawisPrice(confirmed.length);
  // Admin can build/edit teams whenever — this only controls what the "Teams" panel
  // tells them about whether players can currently see the split (see the matching
  // showTeams gate in rosterModalBody, views/papawis.js).
  const isConfirmedFull = confirmed.length >= game.max_slots;
  const teamsPubliclyVisible = isConfirmedFull && daysLeft <= PAPAWIS_CUTOFF_DAYS;

  // Not pre-filtered by "already listed" — the same picker is used both to add a player
  // themselves and to add their guests, and only the former can actually collide.
  const playerList = players.map(p => ({
    id: p.id,
    name: displayPlayerName(p.name) + (p.team_name ? ' — ' + p.team_name : ''),
  }));

  // Read-only once a game is completed/cancelled/locked — no drag handle, no move/remove
  // controls, matches the old table's own gating on the Remove button.
  const canManage = !isCompleted && !isCancelled && !isLocked;

  // The reminder only mentions a team if one was already assigned *when it ran* — a
  // signup reminded before teams existed just says "confirmed, no team yet" and nothing
  // ever re-scans it. This is the narrow gap that leaves open: reminded, team assigned
  // afterward, never told. Excludes guests — they have no account/email of their own, same
  // exclusion the automated reminder already applies (see stmtPapawisSignupsDueForReminder).
  const canNotifyTeam = (s) => canManage && !s.guest_name && s.status === 'confirmed' && s.team && s.reminder_sent_at && !s.team_notified_at;

  const signupRow = (s) => {
    const name = s.guest_name ? s.guest_name : displayPlayerName(s.player_name);
    return `<li class="pw-row" ${canManage ? 'draggable="true"' : ''} data-id="${escHtml(s.id)}" data-status="${s.status}" data-name="${escHtml(name)}" data-paid="${s.paid_at ? '1' : '0'}">
      ${canManage ? `<span class="pw-row__handle" aria-hidden="true">⠿</span>` : ''}
      <div class="pw-row__info">
        <div class="pw-row__name">${s.guest_name ? `${escHtml(s.guest_name)} <span class="pw-row__guest-tag">(guest)</span>` : escHtml(displayPlayerName(s.player_name))}</div>
        <div class="pw-row__meta">${s.guest_name ? `Billed to ${escHtml(displayPlayerName(s.player_name))}` : escHtml(s.team_name || '—')}</div>
      </div>
      ${canManage ? `<div class="pw-row__actions">
        ${canNotifyTeam(s) ? `<button class="admin-btn admin-btn--sm" data-notify-team="${escHtml(s.id)}" data-team-label="${escHtml(papawisTeamLabel(s.team))}" title="Reminder already went out before Team ${papawisTeamLabel(s.team)} was assigned — send a one-time catch-up email now.">✉ Notify Team</button>` : ''}
        ${s.status === 'waitlist'
          ? `<button class="pw-move-btn pw-move-btn--confirm" data-move="${escHtml(s.id)}" data-to="confirmed" ${isConfirmedFull ? 'disabled title="Confirmed is full"' : ''}>${ICON_CHEVRON_UP} Confirm</button>`
          : `<button class="pw-move-btn" data-move="${escHtml(s.id)}" data-to="waitlist">${ICON_CHEVRON_DOWN} Waitlist</button>`}
        <button class="admin-btn admin-btn--sm admin-btn--danger" data-remove="${escHtml(s.id)}">Remove</button>
      </div>` : isCompleted && s.status === 'confirmed' ? `<div class="pw-row__actions">${paidStatusHtml(s, unlinkedByPlayer[s.player_id] || [])}</div>` : ''}
    </li>`;
  };

  return `
<div class="agm-edit-bar">
  <a href="/admin/papawis" class="agm-edit-bar__back">${ICON_CHEVRON_L} All Papawis</a>
</div>

<div class="card agm-game-header">
  <div class="agm-game-header__teams">
    <span class="text-lg font-bold text-slate-100">${escHtml(game.title || 'Papawis')}</span>
  </div>
  <div class="agm-game-header__meta">
    <span>${fmtDate(game.date)}</span>
    ${(() => { const t = formatTimeRange(game.start_time, game.end_time) || game.time_label; return t ? `<span class="agm-sep">·</span><span>${escHtml(t)}</span>` : ''; })()}
    ${game.location ? `<span class="agm-sep">·</span><span>${escHtml(game.location)}</span>` : ''}
    <span class="agm-sep">·</span>
    ${statusBadge(game)}
    ${isScheduled ? `<span class="text-xs text-slate-500">Sign-ups open ${fmtDate(addDaysStr(game.date, -game.open_days_before))}, 8:00 AM</span>` : ''}
    <a href="/papawis" target="_blank" class="agm-view-link">View on site ↗</a>
    <button id="pw-copy-messenger" type="button" class="admin-btn admin-btn--sm">${isCompleted ? '📋 Copy Payment Status' : '📋 Copy for Messenger'}</button>
    ${isOpen ? `<button id="pw-lock-btn" type="button" class="admin-btn admin-btn--sm" data-locked="${isLocked ? '1' : '0'}">${isLocked ? '🔓 Unlock Roster' : '🔒 Lock Roster'}</button>` : ''}
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_320px] items-start">

  <div class="flex flex-col gap-4 min-w-0">
    ${isLocked ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Roster — ${confirmed.length}/${game.max_slots}${waitlist.length ? ` · ${waitlist.length} waiting` : ''}</span>
        <span class="text-[11px] text-slate-500">🔒 Locked — read only</span>
      </div>
      <table class="w-full border-collapse">
        <thead><tr>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Name</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Status</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Team</th>
          ${isCompleted ? `<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Paid</th>` : ''}
        </tr></thead>
        <tbody id="pw-locked-body">
          ${[...confirmed, ...waitlist].map(s => lockedSummaryRow(s, { showPaid: isCompleted, unlinkedByPlayer })).join('') || `<tr><td colspan="${isCompleted ? 4 : 3}" class="px-4 py-8 text-center text-sm text-slate-500">No one signed up.</td></tr>`}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="pw-panel pw-panel--confirmed bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-widest pw-panel__label pw-panel__label--confirmed">Confirmed — ${confirmed.length}/${game.max_slots}</span>
        </div>
        <ul class="pw-list" id="pw-list-confirmed" data-status="confirmed">
          ${confirmed.length ? confirmed.map(signupRow).join('') : '<li class="pw-list__empty">No one confirmed yet.</li>'}
        </ul>
      </div>
      <div class="pw-panel pw-panel--waitlist bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-widest pw-panel__label pw-panel__label--waitlist">Waitlist${waitlist.length ? ` — ${waitlist.length}` : ''}</span>
        </div>
        <ul class="pw-list" id="pw-list-waitlist" data-status="waitlist">
          ${waitlist.length ? waitlist.map(signupRow).join('') : '<li class="pw-list__empty">Nobody waiting.</li>'}
        </ul>
      </div>
    </div>

    ${!isCompleted && !isCancelled ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg" style="overflow:visible">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Add a player or guest</div>
      <div class="p-4 flex flex-col gap-3">
        <div>
          <label class="admin-field-label">Guest names <span class="normal-case font-normal text-slate-600">— optional, comma-separated. Leave blank to add the player below; fill in to add their guests (billed to them) instead.</span></label>
          <input type="text" id="pw-guest-names" class="admin-input" placeholder="e.g. Bryan, Mark">
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[220px]" style="position:relative">
            <label class="admin-field-label">Player</label>
            <input type="text" id="pw-add-player-input" class="admin-input" placeholder="Type a name…" autocomplete="off">
            <input type="hidden" id="pw-add-player-id">
            <div id="pw-add-player-dropdown" class="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-admin-surface2 border border-admin-border rounded-lg shadow-xl" hidden></div>
          </div>
          <div>
            <label class="admin-field-label">Status</label>
            <select id="pw-add-status" class="admin-input">
              <option value="confirmed">Confirmed</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </div>
          <button class="admin-btn" id="pw-add-btn" style="align-self:flex-end">${ICON_PLUS} Add</button>
        </div>
      </div>
      <div id="pw-add-msg" class="px-4 pb-3 text-xs text-error" style="display:none"></div>
    </div>
    ` : ''}
    `}

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Activity Log</div>
      ${activity.length ? `<table class="w-full border-collapse">
        ${activityTableHead(false)}
        <tbody>${activity.map(e => activityRow(e)).join('')}</tbody>
      </table>` : '<div class="px-4 py-8 text-center text-sm text-slate-500">No activity yet.</div>'}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    ${isOpen && !isLocked ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Teams</div>
      <div class="p-4 flex flex-col gap-2">
        <p class="text-xs text-slate-500 leading-relaxed">Split the confirmed roster into LIGHT/DARK scrimmage sides, balanced by position and height. You can build this anytime.</p>
        <p class="text-[11px] ${teamsPubliclyVisible ? 'text-emerald-400' : 'text-slate-600'}">${teamsPubliclyVisible
          ? '● Visible to players now.'
          : `○ Not visible to players yet — needs to be full (${confirmed.length}/${game.max_slots}) and within ${PAPAWIS_CUTOFF_DAYS} days of game day.`}</p>
        <a href="/admin/papawis/${escHtml(game.id)}/teams" class="agm-new-btn">${confirmed.some(s => s.team) ? 'View Teams' : 'Create Teams'}</a>
      </div>
    </div>
    ` : ''}
    ${isOpen ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Close out</div>
      <div class="p-4 flex flex-col gap-3">
        <p class="text-xs text-slate-500 leading-relaxed">No division — pick a flat, rounded price. Every confirmed player (${confirmed.length}) gets charged exactly that.</p>
        <div>
          <label class="admin-field-label">Price per player</label>
          <input type="number" id="pw-price" class="admin-input" placeholder="e.g. 250" min="0" step="1" ${defaultPrice ? `value="${defaultPrice}"` : ''}>
        </div>
        <div id="pw-complete-msg" class="text-xs text-error" style="display:none"></div>
        <button class="admin-btn admin-btn--danger" id="pw-cancel-game-btn">Cancel game</button>
        <button class="agm-new-btn" id="pw-complete-btn">${ICON_CHECK} Confirm &amp; charge</button>
      </div>
    </div>
    ` : isCompleted ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Closed out</div>
      <div class="p-4 flex flex-col gap-3">
        <div>
          <div class="text-2xl font-extrabold font-saira text-brand">₱${Number(game.price_per_player || 0).toLocaleString()}</div>
          <div class="text-xs text-slate-500 mt-1">per player · ${confirmed.length} charged</div>
          <div class="text-xs mt-2 ${confirmed.every(s => s.paid_at) && confirmed.length ? 'text-emerald-400' : 'text-slate-500'}">${confirmed.filter(s => s.paid_at).length}/${confirmed.length} paid</div>
        </div>
        <div class="pt-2 border-t border-admin-border">
          <button class="admin-btn admin-btn--sm" id="pw-send-emails-btn">📧 Send payment emails</button>
          <p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">Emails every confirmed player their total for this game with a link to settle up. Doesn't re-charge anyone — sends regardless of the reminder-emails toggle, since this is a deliberate one-off action.</p>
          <div id="pw-send-emails-msg" class="text-xs mt-1.5 min-h-[16px]"></div>
        </div>
      </div>
    </div>
    ` : `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Cancelled</div>
      <div class="p-4 text-xs text-slate-500">No charges were made for this game.</div>
    </div>
    `}

    <div class="pt-1">
      <button id="pw-delete-btn" class="admin-btn admin-btn--danger">${ICON_TRASH} Delete papawis</button>
    </div>
  </div>

</div>

<script>
(function() {
  var gameId = ${JSON.stringify(game.id)};
  var players = ${JSON.stringify(playerList)};
  var isCompleted = ${JSON.stringify(isCompleted)};

  // ── Copy for Messenger ────────────────────────────────────────────────
  var gcMeta = ${JSON.stringify({
    date: game.date,
    start_time: game.start_time,
    end_time: game.end_time,
    location: game.location || '',
    max_slots: game.max_slots,
  })};

  function pwCompactClock(hhmm) {
    var parts = hhmm.split(':');
    var h = Number(parts[0]), m = Number(parts[1]);
    var period = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? (h12 + period) : (h12 + ':' + String(m).padStart(2, '0') + period);
  }

  // Reads straight off the current DOM order rather than a snapshot taken at page load —
  // drag-and-drop reorders, confirmed/waitlist moves, and Mark Paid/Unmark all update the
  // DOM (and persist to the server) without a page reload, so a baked-in array would
  // silently go stale the moment an admin touched anything without refreshing first.
  function pwCurrentNames(status) {
    var list = document.getElementById('pw-list-' + status);
    if (!list) return [];
    return Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) { return li.dataset.name || ''; });
  }

  // A locked roster swaps the interactive board for a static summary table (see
  // isLocked in adminPapawisDetailBody) — read whichever one is actually in the DOM.
  function pwCurrentConfirmedWithPaid() {
    var list = document.getElementById('pw-list-confirmed');
    if (list) {
      return Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) {
        return { name: li.dataset.name || '', paid: li.dataset.paid === '1' };
      });
    }
    var lockedBody = document.getElementById('pw-locked-body');
    if (!lockedBody) return [];
    return Array.prototype.slice.call(lockedBody.querySelectorAll('tr[data-status="confirmed"]')).map(function(tr) {
      return { name: tr.dataset.name || '', paid: tr.dataset.paid === '1' };
    });
  }

  function buildPaymentStatusText() {
    var d = new Date(gcMeta.date + 'T00:00:00');
    var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var confirmed = pwCurrentConfirmedWithPaid();

    var lines = [];
    lines.push('🏀 PPWS : ' + monthDay + ' — Payment Status 🏀');
    lines.push('');
    confirmed.forEach(function(p, i) {
      lines.push((i + 1) + '. ' + p.name + ' ' + (p.paid ? '✅' : '❌'));
    });
    lines.push('');
    lines.push('❌ = still unpaid — settle up through the Portal or send an admin your payment directly.');
    return lines.join('\\n');
  }

  function buildMessengerText() {
    if (isCompleted) return buildPaymentStatusText();

    var d = new Date(gcMeta.date + 'T00:00:00');
    var dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var timeRange = (gcMeta.start_time && gcMeta.end_time)
      ? (pwCompactClock(gcMeta.start_time) + '-' + pwCompactClock(gcMeta.end_time))
      : '';
    var confirmedNames = pwCurrentNames('confirmed');
    var waitlistNames   = pwCurrentNames('waitlist');

    var lines = [];
    lines.push('Papawis sign-ups are open! 🏀');
    lines.push('Head to the WKND Portal (https://wkndbasketball.com/papawis), log in, and tap Join to grab a slot. First come, first served — once we hit the slot limit, extra names go on the waitlist.');
    lines.push('');
    lines.push('⚠ Not able to make it? Cancel on the portal at least 3 days before game day. After that, message an admin directly — no-shows without notice may affect future priority. ⚠');
    lines.push('');
    lines.push('🏀 PPWS : ' + dayName + ' : ' + timeRange + ' - ' + monthDay + ' 🏀');
    if (gcMeta.location) lines.push('📍 ' + gcMeta.location);
    lines.push('');
    for (var i = 0; i < gcMeta.max_slots; i++) {
      lines.push((i + 1) + '. ' + (confirmedNames[i] || ''));
    }
    if (waitlistNames.length) {
      lines.push('');
      lines.push('Waitlist:');
      waitlistNames.forEach(function(name, i) { lines.push((i + 1) + '. ' + name); });
    }
    lines.push('');
    lines.push('💸 After the game, you can settle up anytime through your Portal account — totally optional, you can always just send payment straight to an admin instead.');
    return lines.join('\\n');
  }

  var lockBtn = document.getElementById('pw-lock-btn');
  if (lockBtn) {
    lockBtn.addEventListener('click', function() {
      var locked = lockBtn.dataset.locked === '1';
      var msg = locked
        ? 'Unlock this roster? You\\'ll be able to edit signups and teams again.'
        : 'Lock this roster? Signups and teams become read-only until you unlock it.';
      if (!confirm(msg)) return;
      lockBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/' + (locked ? 'unlock' : 'lock'), { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); lockBtn.disabled = false; } })
        .catch(function() { alert('Network error'); lockBtn.disabled = false; });
    });
  }

  var copyBtn = document.getElementById('pw-copy-messenger');
  if (copyBtn) {
    var copyBtnDefault = copyBtn.textContent;
    copyBtn.addEventListener('click', function() {
      var text = buildMessengerText();
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function() { copyBtn.textContent = copyBtnDefault; }, 1800);
      }).catch(function() {
        alert('Could not copy automatically — copy the text below:\\n\\n' + text);
      });
    });
  }

  var pInput    = document.getElementById('pw-add-player-input');
  var pHidden   = document.getElementById('pw-add-player-id');
  var pDropdown = document.getElementById('pw-add-player-dropdown');

  if (pInput) {
    function renderDropdown() {
      var q = pInput.value.trim().toLowerCase();
      var matches = players.filter(function(p) {
        return !q || p.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      if (!matches.length) { pDropdown.hidden = true; pDropdown.innerHTML = ''; return; }
      pDropdown.innerHTML = matches.map(function(p) {
        var div = document.createElement('div');
        div.className = 'px-3 py-2 text-sm text-slate-200 hover:bg-white/5 cursor-pointer';
        div.textContent = p.name;
        div.dataset.id = p.id;
        div.dataset.name = p.name;
        return div.outerHTML;
      }).join('');
      pDropdown.hidden = false;
    }
    pInput.addEventListener('focus', renderDropdown);
    pInput.addEventListener('input', function() { pHidden.value = ''; renderDropdown(); });
    pDropdown.addEventListener('mousedown', function(e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      pHidden.value = item.dataset.id;
      pInput.value = item.dataset.name;
      pDropdown.hidden = true;
    });
    document.addEventListener('click', function(e) {
      if (e.target !== pInput && !pDropdown.contains(e.target)) pDropdown.hidden = true;
    });
  }

  // ── Confirmed/Waitlist: move buttons + drag-and-drop reorder ─────────────
  var pwLists = Array.prototype.slice.call(document.querySelectorAll('.pw-list'));

  function pwListEl(status) { return document.getElementById('pw-list-' + status); }

  function pwPersistOrder(status) {
    var list = pwListEl(status);
    if (!list) return Promise.resolve();
    var ids = Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) { return li.dataset.id; });
    if (!ids.length) return Promise.resolve();
    return fetch('/admin/papawis/' + gameId + '/signups/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, ids: ids })
    });
  }

  // Button-based move — the reliable path (also the only one that works on touch,
  // since native HTML5 drag-and-drop below is desktop/mouse only).
  document.querySelectorAll('[data-move]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sid = btn.dataset.move, to = btn.dataset.to;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not move.'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  document.querySelectorAll('[data-notify-team]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Send a one-time "you\\'re on Team ' + btn.dataset.teamLabel + '" email now?')) return;
      var sid = btn.dataset.notifyTeam;
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/notify-team', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not send.'); btn.disabled = false; btn.textContent = '✉ Notify Team'; } })
        .catch(function() { alert('Network error'); btn.disabled = false; btn.textContent = '✉ Notify Team'; });
    });
  });

  // Drag-and-drop: reorders within a list, or moves between the two (server has final
  // say on the confirmed-list cap — a rejected cross-list move just reloads to the
  // last-saved state instead of leaving the UI showing a drop that didn't actually stick).
  var draggingRow = null, draggingFrom = null;

  document.querySelectorAll('.pw-row[draggable="true"]').forEach(function(row) {
    row.addEventListener('dragstart', function() {
      draggingRow = row;
      draggingFrom = row.dataset.status;
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('is-dragging');
      pwLists.forEach(function(l) { l.classList.remove('is-drag-over'); l.classList.remove('is-drag-blocked'); });
      draggingRow = null; draggingFrom = null;
    });
  });

  function pwRowAfterPoint(list, y) {
    var rows = Array.prototype.slice.call(list.querySelectorAll('.pw-row:not(.is-dragging)'));
    var closest = null, closestOffset = -Infinity;
    rows.forEach(function(r) {
      var box = r.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = r; }
    });
    return closest;
  }

  pwLists.forEach(function(list) {
    list.addEventListener('dragover', function(e) {
      if (!draggingRow) return;
      // Only a cross-list drag actually adds a new row to Confirmed — reordering
      // within an already-full Confirmed list doesn't grow it, so that stays allowed.
      var isConfirmedList = list.dataset.status === 'confirmed';
      var wouldExceed = isConfirmedList && draggingFrom !== 'confirmed'
        && list.querySelectorAll('.pw-row:not(.is-dragging)').length >= gcMeta.max_slots;
      if (wouldExceed) {
        list.classList.remove('is-drag-over');
        list.classList.add('is-drag-blocked');
        return; // no preventDefault() — browser shows its native not-allowed cursor and blocks the drop
      }
      e.preventDefault();
      list.classList.remove('is-drag-blocked');
      list.classList.add('is-drag-over');
      var empty = list.querySelector('.pw-list__empty');
      if (empty) empty.remove();
      var after = pwRowAfterPoint(list, e.clientY);
      if (after == null) list.appendChild(draggingRow);
      else list.insertBefore(draggingRow, after);
    });
    list.addEventListener('dragleave', function(e) {
      if (e.target === list) { list.classList.remove('is-drag-over'); list.classList.remove('is-drag-blocked'); }
    });
    list.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!draggingRow) return;
      list.classList.remove('is-drag-over');
      list.classList.remove('is-drag-blocked');
      var toStatus = list.dataset.status;
      var sid = draggingRow.dataset.id;
      if (draggingFrom === toStatus) {
        pwPersistOrder(toStatus);
      } else {
        draggingRow.dataset.status = toStatus;
        fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok) return pwPersistOrder(toStatus).then(function() { location.reload(); });
          alert(d.error || 'Could not move.'); location.reload();
        })
        .catch(function() { alert('Network error'); location.reload(); });
      }
    });
  });

  document.querySelectorAll('[data-remove]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Remove this player from the papawis?')) return;
      var sid = btn.dataset.remove;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/remove/' + sid, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); btn.disabled = false; } })
        .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  function pwSetPaid(sid, paid, btn) {
    btn.disabled = true;
    fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/paid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: paid })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not update.'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
  }
  document.querySelectorAll('[data-mark-paid]').forEach(function(btn) {
    btn.addEventListener('click', function() { pwSetPaid(btn.dataset.markPaid, true, btn); });
  });
  document.querySelectorAll('[data-unmark-paid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Unmark as paid? This voids the recorded payment in the ledger.')) return;
      pwSetPaid(btn.dataset.unmarkPaid, false, btn);
    });
  });
  document.querySelectorAll('[data-link-payment]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sid = btn.dataset.linkPayment, txId = btn.dataset.txId;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/link-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_id: txId })
      })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not link.'); btn.disabled = false; } })
        .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  var sendEmailsBtn = document.getElementById('pw-send-emails-btn');
  if (sendEmailsBtn) {
    sendEmailsBtn.addEventListener('click', function() {
      if (!confirm('Email every confirmed player their total for this game?')) return;
      var msg = document.getElementById('pw-send-emails-msg');
      sendEmailsBtn.disabled = true;
      msg.textContent = 'Sending…';
      msg.className = 'text-xs mt-1.5 min-h-[16px] text-slate-500';
      fetch('/admin/papawis/' + gameId + '/send-payment-emails', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          sendEmailsBtn.disabled = false;
          if (!d.ok) { msg.textContent = d.error || 'Failed to send.'; msg.className = 'text-xs mt-1.5 min-h-[16px] text-error'; return; }
          msg.textContent = 'Sent to ' + d.sent + (d.sent === 1 ? ' player' : ' players') + (d.errors && d.errors.length ? ' (' + d.errors.length + ' failed)' : '.');
          msg.className = 'text-xs mt-1.5 min-h-[16px] text-emerald-400';
        })
        .catch(function() {
          sendEmailsBtn.disabled = false;
          msg.textContent = 'Network error.';
          msg.className = 'text-xs mt-1.5 min-h-[16px] text-error';
        });
    });
  }

  var addBtn = document.getElementById('pw-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var pid = pHidden.value;
      var status = document.getElementById('pw-add-status').value;
      var guestNames = document.getElementById('pw-guest-names').value;
      var msg = document.getElementById('pw-add-msg');
      msg.style.display = 'none';
      if (!pid) { msg.textContent = 'Select a player first.'; msg.style.display = 'block'; return; }
      addBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: pid, status: status, guest_names: guestNames })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed to add.'; msg.style.display = 'block'; addBtn.disabled = false; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; addBtn.disabled = false; });
    });
  }

  var completeBtn = document.getElementById('pw-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', function() {
      var price = document.getElementById('pw-price').value;
      var msg = document.getElementById('pw-complete-msg');
      msg.style.display = 'none';
      if (!price || Number(price) <= 0) { msg.textContent = 'Enter a valid price per player.'; msg.style.display = 'block'; return; }
      if (!confirm('Charge ₱' + price + ' to every confirmed player? This cannot be undone from here.')) return;
      completeBtn.disabled = true; completeBtn.textContent = 'Charging…';
      fetch('/admin/papawis/' + gameId + '/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_player: Number(price) })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed.'; msg.style.display = 'block'; completeBtn.disabled = false; completeBtn.textContent = '${ICON_CHECK} Confirm & charge'; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; completeBtn.disabled = false; });
    });
  }

  var cancelGameBtn = document.getElementById('pw-cancel-game-btn');
  if (cancelGameBtn) {
    cancelGameBtn.addEventListener('click', function() {
      if (!confirm('Cancel this papawis? No charges will be made.')) return;
      cancelGameBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/cancel', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); cancelGameBtn.disabled = false; } })
        .catch(function() { alert('Network error'); cancelGameBtn.disabled = false; });
    });
  }

  document.getElementById('pw-delete-btn').addEventListener('click', function() {
    if (!confirm('Delete this papawis entirely? This removes all signups and cannot be undone.')) return;
    var btn = this;
    btn.disabled = true;
    fetch('/admin/papawis/' + gameId, { method: 'DELETE' })
      .then(function(r) { if (r.ok) { window.location.href = '/admin/papawis'; } else { alert('Failed'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
  });
})();
</script>`;
}

// ── Teams (LIGHT vs DARK scrimmage split) ─────────────────────────────────────
function teamRosterRow(r) {
  let positions = [];
  try { positions = JSON.parse(r.positions || '[]'); } catch { /* leave empty */ }
  const heightCm = parseHeightCm(r.height);
  const name = r.guest_name ? escHtml(r.guest_name) : escHtml(displayPlayerName(r.player_name));
  return `<li class="pwt-row" draggable="true" data-id="${escHtml(r.id)}" data-team="${r.team}">
    <span class="pwt-row__handle" aria-hidden="true">⠿</span>
    <div class="pwt-row__info">
      <div class="pwt-row__name">${name}${r.guest_name ? ' <span class="pwt-row__guest-tag">(guest)</span>' : ''}</div>
      <div class="pwt-row__meta">${positions.join('/') || '—'}${heightCm ? ` · ${Math.round(heightCm)}cm` : ''}</div>
    </div>
  </li>`;
}

export function adminPapawisTeamsBody({ game, roster = [] } = {}) {
  const light = roster.filter(r => r.team === 'light');
  const dark  = roster.filter(r => r.team === 'dark');
  const unassigned = roster.filter(r => r.team !== 'light' && r.team !== 'dark');

  return `
<div class="agm-edit-bar">
  <a href="/admin/papawis/${escHtml(game.id)}" class="agm-edit-bar__back">${ICON_CHEVRON_L} ${escHtml(game.title || 'Papawis')}</a>
</div>

<div class="flex flex-wrap items-center justify-between gap-3 mt-4 mb-5">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Teams — ${escHtml(game.title || 'Papawis')}</h2>
  <button class="admin-btn" id="pwt-reshuffle-btn">↻ Re-shuffle</button>
</div>

<p class="text-xs text-slate-500 mb-4 leading-relaxed">Auto-arranged by position and height (ratings ignored), guests placed randomly. Drag a player across to swap sides — saves immediately.</p>

${unassigned.length ? `<div class="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
  ${unassigned.length} player(s) not yet assigned to a side — drag them into LIGHT or DARK below.
</div>` : ''}

<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
  <div class="pwt-col pwt-col--light rounded-lg overflow-hidden border border-admin-border">
    <div class="px-4 py-3 bg-white text-slate-900 font-bold text-sm uppercase tracking-widest flex items-center justify-between">
      <span>Light</span><span class="font-saira">${light.length}</span>
    </div>
    <ul class="pwt-list" id="pwt-list-light" data-team="light">
      ${light.map(teamRosterRow).join('') || '<li class="pwt-list__empty">Drop players here</li>'}
    </ul>
  </div>
  <div class="pwt-col pwt-col--dark rounded-lg overflow-hidden border border-admin-border">
    <div class="px-4 py-3 bg-slate-950 text-slate-100 font-bold text-sm uppercase tracking-widest flex items-center justify-between">
      <span>Dark</span><span class="font-saira">${dark.length}</span>
    </div>
    <ul class="pwt-list" id="pwt-list-dark" data-team="dark">
      ${dark.map(teamRosterRow).join('') || '<li class="pwt-list__empty">Drop players here</li>'}
    </ul>
  </div>
</div>

${unassigned.length ? `<div class="mt-4">
  <div class="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Unassigned</div>
  <ul class="pwt-list" id="pwt-list-unassigned" data-team="">
    ${unassigned.map(teamRosterRow).join('')}
  </ul>
</div>` : ''}

<script>
(function() {
  var gameId = ${JSON.stringify(game.id)};

  var reshuffleBtn = document.getElementById('pwt-reshuffle-btn');
  reshuffleBtn.addEventListener('click', function() {
    if (!confirm('Re-shuffle both sides from scratch? Any manual swaps you made will be lost.')) return;
    reshuffleBtn.disabled = true;
    fetch('/admin/papawis/' + gameId + '/teams/reshuffle', { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert('Failed'); reshuffleBtn.disabled = false; } })
      .catch(function() { alert('Network error'); reshuffleBtn.disabled = false; });
  });

  var lists = Array.prototype.slice.call(document.querySelectorAll('.pwt-list'));
  var draggingRow = null, draggingFrom = null;

  document.querySelectorAll('.pwt-row').forEach(function(row) {
    row.addEventListener('dragstart', function() {
      draggingRow = row;
      draggingFrom = row.dataset.team;
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('is-dragging');
      lists.forEach(function(l) { l.classList.remove('is-drag-over'); });
      draggingRow = null; draggingFrom = null;
    });
  });

  // Same insertion-point technique as the confirmed/waitlist board above (pwRowAfterPoint)
  // — finds the row whose vertical midpoint the pointer is above, so a mid-list drop lands
  // where it visually looks like it should instead of always jumping to the end.
  function pwtRowAfterPoint(list, y) {
    var rows = Array.prototype.slice.call(list.querySelectorAll('.pwt-row:not(.is-dragging)'));
    var closest = null, closestOffset = -Infinity;
    rows.forEach(function(r) {
      var box = r.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = r; }
    });
    return closest;
  }

  // Best-effort: the row is already visually in place from the dragover reorder, so a
  // failed save just means it'll snap back to the last-saved order on the next reload
  // rather than leaving the page in a broken state.
  function pwtPersistOrder(team) {
    var list = document.getElementById('pwt-list-' + team);
    if (!list) return;
    var ids = Array.prototype.slice.call(list.querySelectorAll('.pwt-row')).map(function(li) { return li.dataset.id; });
    if (!ids.length) return;
    fetch('/admin/papawis/' + gameId + '/teams/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: team, ids: ids })
    }).catch(function() {});
  }

  lists.forEach(function(list) {
    list.addEventListener('dragover', function(e) {
      if (!draggingRow) return;
      e.preventDefault();
      list.classList.add('is-drag-over');
      var empty = list.querySelector('.pwt-list__empty');
      if (empty) empty.remove();
      var after = pwtRowAfterPoint(list, e.clientY);
      if (after == null) list.appendChild(draggingRow);
      else list.insertBefore(draggingRow, after);
    });
    list.addEventListener('dragleave', function(e) {
      if (e.target === list) list.classList.remove('is-drag-over');
    });
    list.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!draggingRow) return;
      list.classList.remove('is-drag-over');
      var toTeam = list.dataset.team;
      var sid = draggingRow.dataset.id;
      // Row is already at the right spot in the DOM (dragover moved it) — just persist.
      if (draggingFrom === toTeam) {
        if (toTeam) pwtPersistOrder(toTeam); // dropping within "Unassigned" isn't a real state
        return;
      }
      draggingRow.dataset.team = toTeam;
      if (!toTeam) return; // dropped into the "Unassigned" bucket isn't a real state — ignore
      fetch('/admin/papawis/' + gameId + '/teams/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signup_id: sid, team: toTeam })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) { alert(d.error || 'Could not move.'); location.reload(); return; }
        pwtPersistOrder(toTeam); // also save the drop position within the new team
      })
      .catch(function() { alert('Network error'); location.reload(); });
    });
  });
})();
</script>`;
}

// ── Activity (global feed + frequent cancellers) ─────────────────────────────
export function adminPapawisActivityBody({ activity = [], cancellers = [] } = {}) {
  const cancellerRow = (c) => `<tr class="border-b border-admin-border/50 last:border-b-0">
      <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 font-saira text-right">${c.cancel_count}</td>
    </tr>`;

  return `
<div class="agm-edit-bar">
  <a href="/admin/papawis" class="agm-edit-bar__back">${ICON_CHEVRON_L} All Papawis</a>
</div>

<h2 class="text-xl font-bold tracking-tight text-slate-100 mt-4 mb-5">Papawis Activity</h2>

<div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start">

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">All Activity</div>
    ${activity.length ? `<table class="w-full border-collapse">
      ${activityTableHead(true)}
      <tbody>${activity.map(e => activityRow(e, { showGame: true })).join('')}</tbody>
    </table>` : '<div class="px-4 py-8 text-center text-sm text-slate-500">No activity yet.</div>'}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Frequent Cancellers</div>
    <table class="w-full border-collapse">
      <tbody>
        ${cancellers.length ? cancellers.map(cancellerRow).join('') : '<tr><td class="px-4 py-8 text-center text-sm text-slate-500">No repeat cancellers yet.</td></tr>'}
      </tbody>
    </table>
  </div>

</div>`;
}
